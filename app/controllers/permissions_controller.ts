import Permission from '#models/permission'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import User from '#models/user'
import RolePermission from '#models/role_permission'
import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import ServiceUserAssignment from '#models/service_user_assignment'
// import PermissionService from '../services/permission_service.js'

const permissionService = new CrudService(Permission)

export default class PermissionsController extends CrudController<typeof Permission> {
  constructor() {
    super(permissionService)
  }

  // Voir tous les rôles
  public async getRoles({ response }: HttpContext) {
    const roles = await Role.query().preload('permissions').where('is_active', true)

    return response.ok(roles)
  }

  // Voir toutes les permissions
  public async getPermissions({ response }: HttpContext) {
    const permissions = await Permission.all()
    return response.ok(permissions)
  }

  // Assigner un rôle à un utilisateur
  public async assignRole(userId: number, roleId: number): Promise<void> {
    const user = await User.findOrFail(userId)
    user.role_id = roleId
    await user.save()
  }

  // Assigner une permission à un rôle
  public async assignPermissionToRole(roleId: number, permissionId: number): Promise<void> {
    const existingAssignment = await RolePermission.query()
      .where('role_id', roleId)
      .where('permission_id', permissionId)
      .first()

    if (!existingAssignment) {
      await RolePermission.create({
        role_id: roleId,
        permission_id: permissionId,
      })
    }
  }

  // Retirer une permission d'un rôle
  public async removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
    await RolePermission.query()
      .where('role_id', roleId)
      .where('permission_id', permissionId)
      .delete()
  }

  // Obtenir toutes les permissions d'un utilisateur
  public async getUserPermissions({ auth, response }: HttpContext) {
    const user = auth.user
    if (!user) {
      return response.unauthorized({ error: 'Utilisateur non authentifié' })
    }

    // On récupère les assignations avec leurs relations
    const assignments = await ServiceUserAssignment.query()
      .where('user_id', user.id)
      .preload('service')
      .preload('roleModel', (roleQuery) => {
        roleQuery.preload('permissions')
      })

    const detailedPermissions = assignments.map((assignment) => ({
      service: {
        id: assignment.service?.id,
        name: assignment.service?.name,
      },
      role: {
        name: assignment.roleModel?.role_name,
        description: assignment.roleModel?.description,
      },
      permissions:
        assignment.roleModel?.permissions.map((p) => ({
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

  // Vérifier si un utilisateur a une permission
  public async userHasPermission(userId: number, permissionName: string): Promise<boolean> {
    const user = await User.findOrFail(userId)
    return await user.hasPermission(permissionName)
  }

  public async listForUser({ auth, response }: HttpContext) {
    const user = auth.user
    if (!user) return response.unauthorized()

    // Préchargement des rôles et des permissions depuis les assignations
    const assignments = await ServiceUserAssignment.query()
      .where('user_id', user.id)
      .preload('roleModel', (roleQuery) => {
        roleQuery.preload('permissions')
      })

    // Récupérer toutes les permissions
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

  //role , permissions , by service id


}
