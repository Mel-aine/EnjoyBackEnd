import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'

export default class PermissionMiddleware {
  async handle(
    { auth, response }: HttpContext,
    next: NextFn,
    options: { permissions: string[] } = { permissions: [] }
  ) {
    const user = auth.user
    if (!user) return response.unauthorized({ message: 'Non authentifié' })

    // Pas de permissions requises → on laisse passer
    if (!options.permissions.length) return next()

    // Récupère le user avec son rôle et les permissions du rôle
    const fullUser = await User.query()
      .where('id', user.id)
      .preload('role', (q) => q.preload('permissions'))
      .firstOrFail()

    const userPermissions = new Set<string>(
      (fullUser.role?.permissions ?? []).map((p) => p.name)
    )

    // Vérifie que l'utilisateur a AU MOINS UNE des permissions requises
    const hasPermission = options.permissions.some((p) => userPermissions.has(p))
    if (!hasPermission) {
      return response.forbidden({
        message: 'Accès refusé — permissions insuffisantes',
        required: options.permissions,
      })
    }

    return next()
  }
}
