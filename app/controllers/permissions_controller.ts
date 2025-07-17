import Permission from '#models/permission'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import User from '#models/user'
import RolePermission from '#models/role_permission'
import Role from '#models/role'
import type { HttpContext } from '@adonisjs/core/http'
import ServiceUserAssignment from '#models/service_user_assignment'
import db from '@adonisjs/lucid/services/db'
import LoggerService from '#services/logger_service'
import auth from '@ioc:Adonis/auth/build/services/auth.js'

const permissionService = new CrudService(Permission)

export default class PermissionsController extends CrudController<typeof Permission> {
  constructor() {
    super(permissionService)
  }

  public async getUserPermissions(ctx: HttpContext) {
    const { response, auth } = ctx
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

  public async updateRolePermissions(
    roleId: number,
    permissionIds: number[],
    serviceId?: number,
    userId?: number,
    ctx?: HttpContext,
  ): Promise<void> {
    const trx = await db.transaction()

    try {
      const existingPermissions = await RolePermission
        .query({ client: trx })
        .where('role_id', roleId)
        .andWhere((q) => {
          if (serviceId) q.where('service_id', serviceId)
        })

      const beforePermissions = existingPermissions.map(p => p.permission_id)

      await RolePermission.query({ client: trx })
        .where('role_id', roleId)
        .andWhere((q) => {
          if (serviceId) q.where('service_id', serviceId)
        })
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

      if (ctx?.auth.user || userId) {
        const role = await Role.find(roleId)
        const roleName = role?.role_name || `Rôle #${roleId}`

        const changes = {
          permissions: {
            old: beforePermissions,
            new: permissionIds,
          },
        }

        await LoggerService.log({
          actorId: ctx?.auth?.user?.id || userId!,
          action: 'UPDATE',
          entityType: 'RolePermission',
          entityId: `${roleId}`,
          description: `Modification des permissions pour le rôle "${roleName}"`,
          changes,
          ctx: ctx!,
        })
      }

    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}
