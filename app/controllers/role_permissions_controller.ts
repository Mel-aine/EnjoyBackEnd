
import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import RolePermission from '#models/role_permission'
import type { HttpContext } from '@adonisjs/core/http'

const rolePermissionService = new CrudService(RolePermission)

export default class RolePermissionsController extends CrudController<typeof RolePermission> {
  constructor() {
    super(rolePermissionService)
  }

async assignPermissions({ request, response }: HttpContext) {
  const { role_id, permissions, user_id, service_id } = request.only([
    'role_id',
    'permissions',
    'user_id',
    'service_id',
  ])

  if (!role_id || !Array.isArray(permissions) || !user_id || !service_id) {
    return response.badRequest({
      message: 'role_id, permissions, service_id et user_id sont requis',
    })
  }

  const permissionIds = permissions.map((p) => p.permission_id)

  await RolePermission.query()
    .where('role_id', role_id)
    .andWhere('service_id', service_id)
    .whereNotIn('permission_id', permissionIds)
    .delete()

  const updatedPermissionIds: number[] = []


  for (const perm of permissions) {
    const { permission_id } = perm
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

  return response.ok({
    message: 'Permissions mises à jour avec succès',
    updated_ids: updatedPermissionIds,
  })
}


}
