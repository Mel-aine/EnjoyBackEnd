import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Hotel from '#models/hotel'

export default class CheckSubscriptionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, moduleSlug: string) {
    // Try to get hotel from context (set by ApiKeyMiddleware) or from user
    let hotel: Hotel | null = (ctx as any).hotel

    if (!hotel) {
      const user = ctx.auth.user
      if (user && user.hotelId) {
        hotel = await Hotel.find(user.hotelId)
      }
    }

    if (!hotel) {
      return ctx.response.unauthorized({ message: 'Authentication required or Hotel not found' })
    }

    // Check subscription access
    const hasAccess = await hotel.hasAccessTo(moduleSlug)

    if (!hasAccess) {
      return ctx.response.forbidden({
        message: `Subscription required for module: ${moduleSlug}`,
        code: 'SUBSCRIPTION_REQUIRED',
        module: moduleSlug
      })
    }

    return next()
  }
}