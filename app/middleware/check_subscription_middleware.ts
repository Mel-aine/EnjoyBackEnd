import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Hotel from '#models/hotel'
import ServiceUserAssignment from '#models/service_user_assignment'

export default class CheckSubscriptionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, moduleSlug: string) {
    let hotel: Hotel | null = (ctx as any).hotel

    const headerHotelRaw =
      ctx.request.header('x-hotel-id') ||
      ctx.request.header('X-Hotel-Id') ||
      ctx.request.header('x-hotel-code') ||
      ctx.request.header('X-Hotel-Code')
    const headerHotelId = headerHotelRaw ? Number(String(headerHotelRaw).trim()) : undefined
    const requestedHotelId = headerHotelId && !Number.isNaN(headerHotelId) ? headerHotelId : undefined

    if (!hotel) {
      const user = ctx.auth.user
      if (user) {
        if (requestedHotelId) {
          const assignment = await ServiceUserAssignment.query()
            .where('user_id', user.id)
            .andWhere('hotel_id', requestedHotelId)
            .preload('hotel')
            .first()
          if (assignment?.hotel) {
            hotel = assignment.hotel
          }
        }

        if (!hotel && user.hotelId) {
          hotel = await Hotel.find(user.hotelId)
        }

        if (!hotel) {
          const assignment = await ServiceUserAssignment.query()
            .where('user_id', user.id)
            .preload('hotel')
            .first()
          if (assignment?.hotel) {
            hotel = assignment.hotel
          }
        }
      }
    }

    if (!hotel) {
      return ctx.response.unauthorized({ message: 'Authentication required or Hotel not found' })
    }

    ;(ctx as any).hotel = hotel

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
