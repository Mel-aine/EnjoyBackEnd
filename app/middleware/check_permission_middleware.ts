
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import PermissionService from '../services/permission_service.js'

export default class CheckPermissionMiddleware {
  public async handle(
    ctx: HttpContext,
    next: NextFn,
    guards: string[] = [] // Liste des permissions à vérifier, ex: ['dashboard.view']
  ) {
    const { auth, params, response } = ctx
    const user = auth.user

    // Si l'utilisateur n'est pas connecté
    if (!user) {
      return response.unauthorized({ error: 'Utilisateur non authentifié' })
    }

    // Vérifie qu'on a bien un ID de service dans les paramètres de l'URL
    const serviceId = Number(params.serviceId)
    if (!serviceId) {
      return response.badRequest({ error: 'Identifiant du service manquant' })
    }

    // Si aucune permission n'est spécifiée, on autorise l'accès
    if (guards.length === 0) {
      return await next()
    }

    // Vérifie si l'utilisateur a l'une des permissions demandées dans ce service
for (const permissionSlug of guards) {
  // Ajoute un log clair de ce qui est testé
  console.log('[Middleware] Vérification de permission :', {
    userId: user.id,
    serviceId,
    permissionSlug,
  })

  // Appel du service
  const isAllowed = await PermissionService.hasPermission(user.id, Number(serviceId), permissionSlug)

  if (isAllowed) {
    console.log('[Middleware] ✅ Permission accordée')
    return await next() // Autorisé, on continue
  }
}

// Si aucune permission n’est valide → accès interdit
console.log('[Middleware] ❌ Aucune permission trouvée')
console.log('params:', params)
console.log('user:', user)

return response.forbidden({
  error: "Vous n'avez pas la permission requise",
})

    // Si aucune permission n'est présente, on bloque l'accès
    return response.forbidden({
      error: 'Vous n\'avez pas la permission requise',
    })
  }
}
