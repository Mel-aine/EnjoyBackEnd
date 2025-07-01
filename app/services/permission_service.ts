import ServiceUserAssignment from '#models/service_user_assignment'
import Role from '#models/role'

export default class PermissionService {
  /**
   * Vérifie si un utilisateur a une permission dans un service donné
   */
  public static async hasPermission(userId: number, serviceId: number, permissionSlug: string): Promise<boolean> {
    const assignment = await ServiceUserAssignment
      .query()
      .where('user_id', userId)
      .andWhere('service_id', serviceId)
      .first()

    if (!assignment) return false

    const role = await Role
      .query()
      .where('role_name', assignment.role)
      .andWhere('service_id', serviceId)
      .preload('permissions')
      .first()

    if (!role) return false

    // Vérifie si le rôle a la permission demandée (ex : 'dashboard.view')
    return role.permissions.some(p => `${p.name}` === permissionSlug)
  }
}
