import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Hotel from '#models/hotel'

export default class CheckOfflineModeMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const hotelId = ctx.request.input('hotelId')

    if (!hotelId) {
      return ctx.response.badRequest({ message: 'hotelId is required for offline sync operations' })
    }

    const hotel = await Hotel.find(hotelId)
    if (!hotel) {
      return ctx.response.notFound({ message: 'Hotel not found' })
    }

    if (!hotel.offlineModeEnabled) {
      return ctx.response.forbidden({
        message: 'Offline mode is not enabled for this hotel',
        code: 'OFFLINE_MODE_DISABLED',
      })
    }

    // Attach hotel to context for downstream use
    ;(ctx as any).hotel = hotel

    return next()
  }
}
