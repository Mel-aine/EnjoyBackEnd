import ServiceUserAssignment from '#models/service_user_assignment'
import Role from '#models/role'
import Service from '#models/hotel'
import RolePermission from '#models/role_permission'
import Permission from '#models/permission'

export default class PermissionService {
  /**
   * Vérifie si un utilisateur a une permission dans un service donné
   */
 public static async hasPermission(userId: number, hotelId: number, permissionSlug: string): Promise<boolean> {
  console.log('[PermissionService] ➤ Vérification de permission :', {
    userId,
    hotelId,
    permissionSlug
  })

  // 1. Vérifie si l'utilisateur est assigné au service
  const assignment = await ServiceUserAssignment
    .query()
    .where('user_id', userId)
    .andWhere('service_id', hotelId)
    .first()

  if (!assignment) {
    console.log('[PermissionService] ❌ Aucune assignation trouvée')
    return false
  }

  // 2. Récupère le service pour connaître sa category_id
  const service = await Service.find(hotelId)
  if (!service) {
    console.log('[PermissionService] ❌ Service introuvable')
    return false
  }

  // 3. Recherche du rôle avec la même logique que getRolesByService
  const role = await Role
    .query()
    .where('role_name', assignment.role.id)
    .andWhere(query => {
      query
        .where('service_id', hotelId)
        .orWhere(subQuery => {
          subQuery
            .whereNull('service_id')
        })
        .orWhere(subQuery => {
          subQuery
            .where('role_name', 'admin')
            .andWhereNull('service_id')
            .andWhereNull('category_id')
        })
    })
    .preload('permissions')
    .first()

  if (!role) {
    console.warn('[PermissionService] ⚠️ Aucun rôle trouvé pour cette assignation')
    return false
  }

  // Étape 3 : vérifier si la permission demandée est dans la liste du rôle
  const hasPerm = role.permissions.some(p => p.name === permissionSlug)

  console.log(`[PermissionService] Résultat : ${hasPerm ? '✅ autorisé' : '❌ refusé'} — Rôle: ${role.roleName}, Permissions:`, role.permissions.map(p => p.name))

  return hasPerm
}

// Retourne un tableau de slugs de permissions de l'utilisateur sur un service donné
public static async getPermissions(userId: number, hotelId: number): Promise<string[]> {
  const assignment = await ServiceUserAssignment
    .query()
    .where('user_id', userId)
    .andWhere('service_id', hotelId)
    .first()

  if (!assignment) return []

  const service = await Service.find(hotelId)
  if (!service) return []

  const role = await Role
    .query()
    .where('role_name', assignment.role.name)
    .andWhere(query => {
      query
        .where('service_id', hotelId)
        .orWhere(subQuery => {
          subQuery
            .whereNull('service_id')
        })
        .orWhere(subQuery => {
          subQuery
            .where('role_name', 'admin')
            .andWhereNull('service_id')
            .andWhereNull('category_id')
        })
    })
    .preload('permissions')
    .first()

  if (!role) return []

  return role.permissions.map(p => p.name)
}

 public async assignAllPermissionsToAdminForService(hotelId: number, createdBy: number) {
    const adminRole = await Role.findBy('role_name', 'admin')
    if (!adminRole) {
      throw new Error('Rôle admin introuvable')
    }

    const allPermissions = await Permission.all()

    for (const permission of allPermissions) {
      const exists = await RolePermission.query()
        .where('role_id', adminRole.id)
        .andWhere('permission_id', permission.id)
        .andWhere('service_id', hotelId)
        .first()

      if (!exists) {
        await RolePermission.create({
          role_id: adminRole.id,
          permission_id: permission.id,
          hotel_id: hotelId,
          created_by: createdBy,
          last_modified_by: createdBy,
        })
      }
    }
  }

}
