import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Hotel from '#models/hotel'
import ServiceUserAssignment from '#models/service_user_assignment'

/**
 * Channex routes take the target in the URL (`:propertyId` = Channex property,
 * or `:hotelId` = enjoy hotel). Without this check, any signed-in user could
 * read or change the availability, prices and restrictions of another hotel
 * (and, since the Hub OTA link, of its hub listing too).
 *
 * The user must be assigned to the hotel (service_user_assignments) or have it
 * as main hotel. Routes without those params are not affected.
 */
export default class ChannexPropertyAccessMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { params, response } = ctx
    const propertyId = params?.propertyId
    const rawHotelId = params?.hotelId

    if (!propertyId && !rawHotelId) return next()

    const user = ctx.auth?.user as any
    if (!user) return response.unauthorized({ message: 'Authentication required' })

    let hotel: Hotel | null = null
    if (propertyId) {
      hotel = await Hotel.query().where('channex_property_id', String(propertyId)).first()
    } else {
      const hotelId = Number(rawHotelId)
      hotel = Number.isInteger(hotelId) ? await Hotel.find(hotelId) : null
    }
    if (!hotel) return response.notFound({ message: 'Hotel not found' })

    if (Number(user.hotelId) === hotel.id) return next()

    const assignment = await ServiceUserAssignment.query()
      .where('user_id', user.id)
      .andWhere('hotel_id', hotel.id)
      .first()
    if (!assignment) {
      return response.forbidden({ message: 'You do not have access to this hotel' })
    }

    return next()
  }
}
