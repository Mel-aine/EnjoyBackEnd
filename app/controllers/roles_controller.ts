import Role from '#models/role'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import Hotel from '#models/hotel'
import Permission from '#models/permission'
import RolePermission from '#models/role_permission'
import type { HttpContext } from '@adonisjs/core/http'
import { createRoleValidator, updateRoleValidator } from '#validators/role'

export default class RolesController {
  protected model = Role
  protected crudService = new CrudService(Role)

  /**
   * Récupère tous les rôles avec pagination
   */
  public async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search', '')

      const query = Role.query()
        .preload('hotel')
        .preload('creator')
        .preload('modifier')

      if (search) {
        query.where('role_name', 'ILIKE', `%${search}%`)
          .orWhere('description', 'ILIKE', `%${search}%`)
      }

      const roles = await query.paginate(page, limit)
      return response.ok(roles)
    } catch (error) {
      return response.internalServerError({ message: 'Erreur lors de la récupération des rôles' })
    }
  }

  /**
   * Récupère un rôle par ID
   */
  public async show({ params, response }: HttpContext) {
    const roleId = Number(params.id)

    if (isNaN(roleId)) {
      return response.badRequest({ message: 'ID de rôle invalide' })
    }

    try {
      const role = await Role.query()
        .where('id', roleId)
        .preload('hotel')
        .preload('creator')
        .preload('modifier')
        .preload('permissions')
        .firstOrFail()

      return response.ok(role)
    } catch (error) {
      return response.notFound({ message: 'Rôle non trouvé' })
    }
  }

  /**
   * Crée un nouveau rôle
   */
 public async store({ request, response }: HttpContext) {
  try {
    const payload = await request.validateUsing(createRoleValidator)
    console.log('[STORE] Payload reçu :', payload)

    // Vérifier si l'hôtel existe si hotel_id est fourni
    if (payload.hotelId) {
      await Hotel.findOrFail(payload.hotelId)
    }

    // 🔎 Vérifier si un rôle du même nom existe déjà pour cet hôtel
    const existingRole = await Role.query()
     .whereRaw('LOWER(role_name) = ?', [payload.name.toLowerCase()])
      .andWhere('hotel_id', payload.hotelId!)
      .first()

    if (existingRole) {
      return response.conflict({
        code: 'ROLE_ALREADY_EXISTS',
        message: `Le rôle "${payload.name}" existe déjà dans cet hôtel`
      })
    }

    // ✅ Créer le rôle
    const role = await Role.create({
      roleName: payload.name,
      description: payload.description,
      hotelId: payload.hotelId,
      createdBy: payload.createdBy,
    })

    return response.created(role)
  } catch (error) {
    console.error('[STORE] Erreur attrapée :', error)

    if (error.code === 'E_VALIDATION_FAILURE') {
      return response.badRequest({ message: 'Données invalides', errors: error.messages })
    }

    return response.internalServerError({
      message: 'Erreur lors de la création du rôle'
    })
  }
}


  /**
   * Met à jour un rôle
   */
public async update({ params, request, response }: HttpContext) {
  const roleId = Number(params.id)

  if (isNaN(roleId)) {
    return response.badRequest({ message: 'ID de rôle invalide' })
  }

  try {
    const payload = await request.validateUsing(updateRoleValidator)

    const role = await Role.findOrFail(roleId)

    // Vérifier si l'hôtel existe si hotel_id est fourni
    if (payload.hotelId) {
      await Hotel.findOrFail(payload.hotelId)
    }

    // Vérifier si un autre rôle avec le même nom existe (insensible à la casse)
    const existingRole = await Role.query()
      .whereRaw('LOWER(role_name) = ?', [payload.name.toLowerCase()])
      .where('id', '!=', roleId)
      .first()

    if (existingRole) {
      return response.conflict({
        code: 'ROLE_ALREADY_EXISTS',
        message: `Le rôle "${payload.name}" existe déjà dans cet hôtel`
      })
    }

    // Mettre à jour le rôle
    role.merge({
      roleName: payload.name,
      description: payload.description,
      hotelId: payload.hotelId,
      lastModifiedBy: payload.lastModifiedBy,
    })

    await role.save()

    return response.ok(role)
  } catch (error) {
    if (error.code === 'E_VALIDATION_FAILURE') {
      return response.badRequest({ message: 'Données invalides', errors: error.messages })
    }
    if (error.code === 'E_ROW_NOT_FOUND') {
      return response.notFound({ message: 'Rôle non trouvé' })
    }
    return response.internalServerError({ message: 'Erreur lors de la mise à jour du rôle' })
  }
}

  /**
   * Supprime un rôle
   */
public async destroy({ params, response }: HttpContext) {
  const roleId = Number(params.id)
  console.log('[DESTROY] roleId reçu :', params.id, '→ converti en nombre :', roleId)

  if (isNaN(roleId)) {
    console.log('[DESTROY] ID invalide')
    return response.badRequest({ message: 'ID de rôle invalide' })
  }

  try {
    console.log('[DESTROY] Recherche du rôle dans la DB...')
    const role = await Role.findOrFail(roleId)
    console.log('[DESTROY] Rôle trouvé :', role)

    // Vérifier si le rôle est utilisé par des utilisateurs
    console.log('[DESTROY] Chargement des utilisateurs liés au rôle...')
    await role.load('users')
    console.log('[DESTROY] Utilisateurs liés :', role.users)

    if (role.users.length > 0) {
      console.log('[DESTROY] Rôle utilisé par', role.users.length, 'utilisateur(s)')
      return response.conflict({
        message: 'Impossible de supprimer ce rôle car il est assigné à des utilisateurs'
      })
    }

    console.log('[DESTROY] Suppression du rôle...')
    await role.delete()
    console.log('[DESTROY] Rôle supprimé avec succès')

    return response.ok({ message: 'Rôle supprimé avec succès' })
  } catch (error) {
    console.error('[DESTROY] Erreur attrapée :', error)

    if (error.code === 'E_ROW_NOT_FOUND') {
      console.log('[DESTROY] Rôle non trouvé')
      return response.notFound({ message: 'Rôle non trouvé' })
    }

    console.log('[DESTROY] Erreur serveur')
    return response.internalServerError({ message: 'Erreur lors de la suppression du rôle' })
  }
}


  /**
   * Récupère les rôles par hôtel
   */
  public async getRolesByHotel({ params, response }: HttpContext) {
    const hotelId = Number(params.hotelId)

    if (isNaN(hotelId)) {
      return response.badRequest({ message: 'ID d\'hôtel invalide' })
    }

    try {
      await Hotel.findOrFail(hotelId)

      const roles = await Role.query()
        .where((query) => {
          query.where('hotel_id', hotelId)
        })
        .orWhere((query) => {
          query.where('role_name', 'admin').andWhereNull('hotel_id').andWhereNull('category_id')
        })
        .preload('permissions')

      return response.ok(roles)
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Hôtel non trouvé' })
      }
      return response.internalServerError({ message: 'Erreur lors de la récupération des rôles' })
    }
  }

  /**
   * Récupère les rôles par service avec permissions
   */
  public async getRolesByServiceWithPermissions({ params, response }: HttpContext) {
    const serviceId = Number(params.serviceId)

    if (isNaN(serviceId)) {
      return response.badRequest({ message: 'ID de service invalide' })
    }

    try {
      const service = await Hotel.findOrFail(serviceId)

      const roles = await Role.query()
        .where((query) => {
          query.whereNull('service_id')
        })
        .orWhere((query) => {
          query.where('service_id', serviceId)
        })
        .orWhere((query) => {
          query.where('role_name', 'admin').andWhereNull('service_id').andWhereNull('category_id')
        })

      const result = []

      for (const role of roles) {
        const rolePermissions = await RolePermission.query()
          .where('role_id', role.id)
          .andWhere((query) => {
            query.where('service_id', serviceId).orWhereNull('service_id')
          })
          .preload('permission')

        const permissionsByService: Record<string, any[]> = {}
        let permissionCount = 0

        for (const rp of rolePermissions) {
          const key = rp.hotel_id === null ? 'global' : 'service'

          if (!permissionsByService[key]) {
            permissionsByService[key] = []
          }

          permissionsByService[key].push({
            id: rp.permission.id,
            name: rp.permission.name,
            label: rp.permission.label,
            category: rp.permission.category,
          })

          permissionCount++
        }

        result.push({
          id: role.id,
          name: role.roleName,
          description: role.description,
          permissions: permissionsByService,
          permissionsCount: permissionCount,
        })
      }

      return response.ok({
        totalRoles: result.length,
        roles: result,
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Service non trouvé' })
      }
      return response.internalServerError({ message: 'Erreur lors de la récupération des rôles' })
    }
  }

  /**
   * Assigne des permissions à un rôle
   */
  public async assignPermissions({ params, request, response, auth }: HttpContext) {
    const roleId = Number(params.id)

    if (isNaN(roleId)) {
      return response.badRequest({ message: 'ID de rôle invalide' })
    }

    try {
      const { permissionIds, serviceId } = request.only(['permissionIds', 'serviceId'])
      const user = auth.getUserOrFail()

      if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
        return response.badRequest({ message: 'Liste des permissions requise' })
      }

      const role = await Role.findOrFail(roleId)

      // Vérifier que toutes les permissions existent
      const permissions = await Permission.query().whereIn('id', permissionIds)
      if (permissions.length !== permissionIds.length) {
        return response.badRequest({ message: 'Une ou plusieurs permissions n\'existent pas' })
      }

      // Supprimer les anciennes permissions pour ce service
      if (serviceId) {
        await RolePermission.query()
          .where('role_id', roleId)
          .where('service_id', serviceId)
          .delete()
      } else {
        await RolePermission.query()
          .where('role_id', roleId)
          .whereNull('service_id')
          .delete()
      }

      // Ajouter les nouvelles permissions
      const rolePermissions = permissionIds.map(permissionId => ({
        roleId: roleId,
        permissionId: permissionId,
        serviceId: serviceId || null,
        createdBy: user.id,
      }))

      // await RolePermission.createMany(rolePermissions)

      return response.ok({ message: 'Permissions assignées avec succès' })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Rôle non trouvé' })
      }
      return response.internalServerError({ message: 'Erreur lors de l\'assignation des permissions' })
    }
  }

  /**
   * Retire des permissions d'un rôle
   */
  public async removePermissions({ params, request, response }: HttpContext) {
    const roleId = Number(params.id)

    if (isNaN(roleId)) {
      return response.badRequest({ message: 'ID de rôle invalide' })
    }

    try {
      const { permissionIds, serviceId } = request.only(['permissionIds', 'serviceId'])

      if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
        return response.badRequest({ message: 'Liste des permissions requise' })
      }

      const role = await Role.findOrFail(roleId)

      const query = RolePermission.query()
        .where('role_id', roleId)
        .whereIn('permission_id', permissionIds)

      if (serviceId) {
        query.where('service_id', serviceId)
      } else {
        query.whereNull('service_id')
      }

      await query.delete()

      return response.ok({ message: 'Permissions supprimées avec succès' })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Rôle non trouvé' })
      }
      return response.internalServerError({ message: 'Erreur lors de la suppression des permissions' })
    }
  }

  /**
   * Récupère tous les rôles globaux (admin, etc.)
   */
  public async getGlobalRoles({ response }: HttpContext) {
    try {
      const roles = await Role.query()
        .whereNull('hotel_id')
        .whereNull('service_id')
        .whereNull('category_id')
        .preload('permissions')

      return response.ok(roles)
    } catch (error) {
      return response.internalServerError({ message: 'Erreur lors de la récupération des rôles globaux' })
    }
  }


}
