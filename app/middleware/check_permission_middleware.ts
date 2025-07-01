
import type { HttpContext } from '@adonisjs/core/http'
import PermissionService from '../services/permission_service.js'

export default class CheckPermissionMiddleware {
  public async handle(
    { auth, params, response }: HttpContext,
    next: () => Promise<void>,
    guards: string[] // Liste des permissions à vérifier, ex: ['dashboard.view']
  ) {
    const user = auth.user

    // Si l'utilisateur n'est pas connecté
    if (!user) {
      return response.unauthorized({ error: 'Utilisateur non authentifié' })
    }

    // Vérifie qu'on a bien un ID de service dans les paramètres de l'URL
    const serviceId = params.service_id
    if (!serviceId) {
      return response.badRequest({ error: 'Identifiant du service manquant' })
    }

    // Vérifie si l'utilisateur a l'une des permissions demandées dans ce service
    for (const permissionSlug of guards) {
      const isAllowed = await PermissionService.hasPermission(user.id, serviceId, permissionSlug)
      if (isAllowed) {
        return await next() // Autorisé, on continue
      }
    }

    // Si aucune permission n'est présente, on bloque l'accès
    return response.forbidden({
      error: 'Vous n’avez pas la permission requise',
    })
  }
}
