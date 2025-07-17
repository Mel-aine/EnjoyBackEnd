import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import RolePermission from '#models/role_permission'
import Role from '#models/role'
import Permission from '#models/permission'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'

const rolePermissionService = new CrudService(RolePermission)

export default class RolePermissionsController extends CrudController<typeof RolePermission> {
  constructor() {
    super(rolePermissionService)
  }

  async assignPermissions(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const { role_id, permissions, user_id, service_id } = request.only([
      'role_id',
      'permissions',
      'user_id',
      'service_id',
    ])

    // Validation des données
    if (!role_id || !Array.isArray(permissions) || !user_id || !service_id) {
      return response.badRequest({
        message: 'role_id, permissions, service_id et user_id sont requis',
      })
    }

    // Extraction des IDs de permissions
    const permissionIds = permissions.map((p) => Number(p.permission_id))

    // Récupération des anciennes permissions
    const existingPermissions = await RolePermission.query()
      .where('role_id', role_id)
      .andWhere('service_id', service_id)

    const beforePermissionIds = existingPermissions.map((p) => p.permission_id)

    // Suppression des permissions obsolètes
    await RolePermission.query()
      .where('role_id', role_id)
      .andWhere('service_id', service_id)
      .whereNotIn('permission_id', permissionIds)
      .delete()

    // Mise à jour des permissions
    const updatedPermissionIds: number[] = []
    for (const perm of permissions) {
      const permission_id = Number(perm.permission_id)
      if (!permission_id) continue

      const existing = await RolePermission.query()
        .where('role_id', role_id)
        .andWhere('permission_id', permission_id)
        .andWhere('service_id', service_id)
        .first()

      if (existing) {
        existing.last_modified_by = user_id
        await existing.save()
        updatedPermissionIds.push(existing.id)
      } else {
        const newPerm = await RolePermission.create({
          role_id,
          permission_id,
          service_id,
          created_by: user_id,
          last_modified_by: user_id,
        })
        updatedPermissionIds.push(newPerm.id)
      }
    }

    // Récupération du nom du rôle
    const role = await Role.find(role_id)
    const roleName = role?.role_name || `Rôle inconnu (${role_id})`

    // Récupération des noms des permissions
    const [oldNames, newNames] = await Promise.all([
      this.getPermissionNames(beforePermissionIds.filter((id): id is number => id !== null)),
      this.getPermissionNames(permissionIds)
    ])

    // Création du log
    await LoggerService.log({
      actorId: auth.user!.id,
      action: 'UPDATE',
      entityType: 'RolePermission',
      entityId: `${role_id}`,
      description: `Permissions mises à jour pour le rôle "${roleName}" dans le service #${service_id}`,
      changes: {
        permissions: {
          old: oldNames,
          new: newNames,
        },
      },
      ctx,
    })

    return response.ok({
      message: 'Permissions mises à jour avec succès',
      updated_ids: updatedPermissionIds,
    })
  }

  private async getPermissionNames(ids: number[]): Promise<string[]> {
    if (ids.length === 0) return []
    const permissions = await Permission.query()
      .select('name')
      .whereIn('id', ids)
    return permissions.map(p => p.name)
  }
}