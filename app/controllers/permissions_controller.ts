import Permission from '#models/permission'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import User from '#models/user'
import RolePermission from '#models/role_permission'
import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import ServiceUserAssignment from '#models/service_user_assignment'
import db from '@adonisjs/lucid/services/db'
import LoggerService from '#services/logger_service'

const permissionService = new CrudService(Permission)

export default class PermissionsController extends CrudController<typeof Permission> {
  constructor() {
    super(permissionService)
  }

  public async getRoles({ response }: HttpContext) {
    const roles = await Role.query().preload('permissions').where('is_active', true)
    return response.ok(roles)
  }

  public async getPermissions({ response }: HttpContext) {
    const permissions = await Permission.all()
    return response.ok(permissions)
  }

  public async assignRole(userId: number, roleId: number, ctx?: HttpContext): Promise<void> {
    const user = await User.findOrFail(userId)
    user.role_id = roleId
    await user.save()

    if (ctx?.auth.user) {
      await LoggerService.log({
        actorId: ctx.auth.user.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: userId,
        description: `Role assigned to user #${userId} -> role #${roleId}`,
        ctx,
      })
    }
  }

  public async assignPermissionToRole(roleId: number, permissionId: number, ctx?: HttpContext): Promise<void> {
    const existingAssignment = await RolePermission.query()
      .where('role_id', roleId)
      .where('permission_id', permissionId)
      .first()

    if (!existingAssignment) {
      await RolePermission.create({
        role_id: roleId,
        permission_id: permissionId,
      })

      if (ctx?.auth.user) {
        await LoggerService.log({
          actorId: ctx.auth.user.id,
          action: 'CREATE',
          entityType: 'RolePermission',
          entityId: `${roleId}-${permissionId}`,
          description: `Permission #${permissionId} assigned to role #${roleId}`,
          ctx,
        })
      }
    }
  }

  public async removePermissionFromRole(roleId: number, permissionId: number, ctx?: HttpContext): Promise<void> {
    await RolePermission.query()
      .where('role_id', roleId)
      .where('permission_id', permissionId)
      .delete()

    if (ctx?.auth.user) {
      await LoggerService.log({
        actorId: ctx.auth.user.id,
        action: 'DELETE',
        entityType: 'RolePermission',
        entityId: `${roleId}-${permissionId}`,
        description: `Removed permission #${permissionId} from role #${roleId}`,
        ctx,
      })
    }
  }

  public async getUserPermissions({ auth, response }: HttpContext) {
    const user = auth.user
    if (!user) return response.unauthorized({ error: 'Utilisateur non authentifié' })

    const assignments = await ServiceUserAssignment.query()
      .where('user_id', user.id)
      .preload('service')
      .preload('roleModel', (roleQuery) => roleQuery.preload('permissions'))

    const detailedPermissions = assignments.map((assignment) => ({
      service: {
        id: assignment.service?.id,
        name: assignment.service?.name,
      },
      role: {
        name: assignment.roleModel?.role_name,
        description: assignment.roleModel?.description,
      },
      permissions: assignment.roleModel?.permissions.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.label,
      })) ?? [],
    }))

    return response.ok({
      userId: user.id,
      assignments: detailedPermissions,
    })
  }

  public async userHasPermission(userId: number, permissionName: string): Promise<boolean> {
    const user = await User.findOrFail(userId)
    return await user.hasPermission(permissionName)
  }

  public async listForUser({ auth, response }: HttpContext) {
    const user = auth.user
    if (!user) return response.unauthorized()

    const assignments = await ServiceUserAssignment.query()
      .where('user_id', user.id)
      .preload('roleModel', (roleQuery) => roleQuery.preload('permissions'))

    const permissionsSet = new Set<string>()
    assignments.forEach((assignment) => {
      const role = assignment.roleModel
      if (role && role.permissions) {
        role.permissions.forEach((p) => permissionsSet.add(p.name))
      }
    })

    return response.ok({
      permissions: Array.from(permissionsSet),
    })
  }

  public async assignPermissionsToRole(
    roleId: number,
    permissionIds: number[],
    serviceId?: number,
    userId?: number,
    ctx?: HttpContext
  ): Promise<void> {
    const existingAssignments = await RolePermission.query()
      .where('role_id', roleId)
      .whereIn('permission_id', permissionIds)

    const existingPermissionIds = existingAssignments.map(a => a.permission_id)
    const newPermissionIds = permissionIds.filter(id => !existingPermissionIds.includes(id))

    if (newPermissionIds.length > 0) {
      const newAssignments = newPermissionIds.map(permissionId => ({
        role_id: roleId,
        permission_id: permissionId,
        service_id: serviceId || null,
        created_by: userId || null,
        last_modified_by: userId || null,
      }))

      await RolePermission.createMany(newAssignments)

      if (ctx?.auth.user) {
        await LoggerService.log({
          actorId: ctx.auth.user.id,
          action: 'CREATE',
          entityType: 'RolePermission',
          entityId: roleId,
          description: `Assigned permissions [${newPermissionIds.join(', ')}] to role #${roleId}`,
          ctx,
        })
      }
    }
  }

  public async updateRolePermissions(
    roleId: number,
    permissionIds: number[],
    serviceId?: number,
    userId?: number,
    ctx?: HttpContext
  ): Promise<void> {
    const trx = await db.transaction()

    try {
      await RolePermission.query({ client: trx })
        .where('role_id', roleId)
        .delete()

      if (permissionIds.length > 0) {
        const newAssignments = permissionIds.map(permissionId => ({
          role_id: roleId,
          permission_id: permissionId,
          service_id: serviceId || null,
          created_by: userId || null,
          last_modified_by: userId || null,
        }))

        await RolePermission.createMany(newAssignments, { client: trx })
      }

      await trx.commit()

      if (ctx?.auth.user) {
        await LoggerService.log({
          actorId: ctx.auth.user.id,
          action: 'UPDATE',
          entityType: 'RolePermission',
          entityId: roleId,
          description: `Updated role #${roleId} permissions to: [${permissionIds.join(', ')}]`,
          ctx,
        })
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}
