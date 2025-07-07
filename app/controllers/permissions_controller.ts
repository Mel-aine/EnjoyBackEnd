import Permission from '#models/permission'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import User from '#models/user'
import RolePermission from '#models/role_permission'
import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'

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
  public async getUserPermissions(userId: number): Promise<Permission[]> {
    const user = await User.query()
      .where('id', userId)
      .preload('role', (query) => {
        query.preload('permissions')
      })
      .firstOrFail()

    return user.role?.permissions || []
  }

  // Vérifier si un utilisateur a une permission
  public async userHasPermission(userId: number, permissionName: string): Promise<boolean> {
    const user = await User.findOrFail(userId)
    return await user.hasPermission(permissionName)
  }
}
