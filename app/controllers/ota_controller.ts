import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import RateType from '#models/rate_type'
import ReservationRoomService from '#services/reservation_room_service'
import { PricingService } from '#services/pricingService'

export default class OtaController {
  /**
   * Public: Get basic hotel info for OTA display
   */
  async hotelInfo({ params, response }: HttpContext) {
    try {
      const hotelId = Number(params.hotelId)
      if (isNaN(hotelId)) {
        return response.badRequest({ message: 'Invalid hotelId parameter' })
      }

      const hotel = await Hotel.find(hotelId)
      if (!hotel) {
        return response.notFound({ message: `Hotel ${hotelId} not found` })
      }

      return response.ok({
        message: 'Hotel info retrieved successfully',
        data: {
          id: hotel.id,
          name: hotel.hotelName,
          description: hotel.description,
          amenities: hotel.amenities,
          address: {
            address: hotel.address,
            city: hotel.city,
            stateProvince: hotel.stateProvince,
            country: hotel.country,
            postalCode: hotel.postalCode,
            longitude: hotel.longitude,
            latitude: hotel.latitude
          },
          contacts: {
            email: hotel.email,
            website: hotel.website,
            phoneNumber: hotel.phoneNumber,
          },
          policy: {
            checkInTime: hotel.checkInTime,
            checkOutTime: hotel.checkOutTime,
            cancellationPolicy: hotel.cancellationPolicy,
            hotelPolicy: hotel.hotelPolicy,
          },
          finance: {
            currencyCode: hotel.currencyCode,
            taxRate: hotel.taxRate,
          },
          timezone: hotel.timezone,
        },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Error retrieving hotel info',
        error: error.message,
      })
    }
  }

  /**
   * Public: List room types for a hotel including attached rate types
   */
  async getRoomTypes({ params, response }: HttpContext) {
    try {
      const hotelId = Number(params.hotelId)
      if (isNaN(hotelId)) {
        return response.badRequest({ message: 'Invalid hotelId parameter' })
      }

      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .andWhere('is_deleted', false)
        .preload('rateTypes')
        .orderBy('sort_order', 'asc')

      return response.ok({
        message: 'Room types retrieved successfully',
        data: roomTypes.map((rt) => ({
          id: rt.id,
          name: rt.roomTypeName,
          shortCode: rt.shortCode,
          color: rt.color,
          defaultWebInventory: rt.defaultWebInventory,
          baseCapacity: rt.baseAdult + rt.baseChild,
          maxCapacity: rt.maxAdult + rt.maxChild,
          rateTypes: (rt.rateTypes || []).map((r: RateType) => ({
            id: r.id,
            name: r.rateTypeName,
            shortCode: r.shortCode,
          })),
        })),
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Error retrieving room types',
        error: error.message,
      })
    }
  }

  /**
   * Public: Get availability by room type for date range.
   * Includes attached rate type IDs/names for OTA mapping.
   * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), adults?, children?
   */


async getAvailability({ params, request, response }: HttpContext) {
  try {
    console.log('--- getAvailability called ---')

    const hotelId = Number(params.hotelId)
    console.log('Hotel ID:', hotelId)

    if (isNaN(hotelId)) {
      console.warn('Invalid hotelId parameter')
      return response.badRequest({ message: 'Invalid hotelId parameter' })
    }

    const startDateStr = request.input('startDate')
    const endDateStr = request.input('endDate')
    const adults = request.input('adults') ? Number(request.input('adults')) : 1
    const children = request.input('children') ? Number(request.input('children')) : 0

    console.log('Request params:', { startDateStr, endDateStr, adults, children })

    if (!startDateStr || !endDateStr) {
      console.warn('startDate or endDate missing')
      return response.badRequest({ message: 'startDate and endDate are required' })
    }

    const startDate = DateTime.fromISO(startDateStr)
    const endDate = DateTime.fromISO(endDateStr)

    if (!startDate.isValid || !endDate.isValid) {
      console.warn('Invalid date format', { startDateStr, endDateStr })
      return response.badRequest({ message: 'Invalid date format. Use YYYY-MM-DD' })
    }
    if (endDate <= startDate) {
      console.warn('endDate is before or equal to startDate')
      return response.badRequest({ message: 'endDate must be after startDate' })
    }

    const nights = Math.ceil(endDate.diff(startDate, 'days').days)
    console.log('Number of nights:', nights)

    // Fetch hotel info
    const hotel = await Hotel.findOrFail(hotelId)

    // Fetch room types avec amenities
    const roomTypes = await RoomType.query()
      .where('hotel_id', hotelId)
      .andWhere('is_deleted', false)
      .preload('roomRates', (roomRateQuery) => {
        roomRateQuery
          .preload('rateType')
          .preload('mealPlan')
      })

      .orderBy('sort_order', 'asc')

    console.log(`Found ${roomTypes.length} room types`)

    const service = new ReservationRoomService()
    const pricingService = new PricingService()
    const data = []

    for (const rt of roomTypes) {
      console.log('Processing RoomType:', rt.id, rt.roomTypeName)

      const availableRooms = await service.findAvailableRooms(
        hotelId,
        startDate.toJSDate(),
        endDate.toJSDate(),
        rt.id,
        adults,
        children
      )

      console.log(`Available rooms for RoomType ${rt.id}:`, availableRooms.length)
      if (availableRooms.length === 0) continue

      const totalCapacity = rt.maxAdult + rt.maxChild
      const guestsCount = adults + children
      if (guestsCount > totalCapacity) {
        console.log(`Guests exceed capacity for RoomType ${rt.id}`)
        continue
      }

      const ratePlans = []

      for (const roomRate of rt.roomRates || []) {
        const rateType = roomRate.rateType
        const mealPlan = roomRate.mealPlan

        let pricing = null
        try {
          pricing = await pricingService.calculateStayPrice(
            hotelId,
            rt.id,
            rateType.id,
            startDate.toJSDate(),
            endDate.toJSDate(),
            adults,
            children
          )
        } catch (err) {
          console.error(`Pricing error for RateType ${rateType.id}:`, err)
        }

        const features = []
        if (mealPlan) features.push(mealPlan.name)
        if (roomRate.taxInclude) features.push('Tax Included')
        if (roomRate.mealPlanRateInclude) features.push('Meal Plan Included')

        ratePlans.push({
          id: rateType.id,
          name: rateType.rateTypeName,
          shortCode: rateType.shortCode,
          features,
          price: pricing?.totalAmount ?? null,
          pricePerNight: pricing?.averageNightlyRate ?? null,
          breakdown: pricing
            ? {
                basePrice: pricing.baseAmount,
                taxes: pricing.taxAmount,
                fees: pricing.feesAmount,
                discounts: pricing.discountAmount,
              }
            : null,
          currency: pricing?.currency ?? 'XAF',
          minNights: roomRate.minimumNights || 1,
          maxNights: roomRate.maximumNights || null,
        })
      }

      if (ratePlans.length === 0) continue

      data.push({
        id: rt.id,
        name: rt.roomTypeName,
        shortCode: rt.shortCode,
        // description: rt.description || '',
        // images: rt.images || [],
        roomsLeft: availableRooms.length,
        rooms: availableRooms.map(room => ({
          id: room.id,
          roomNumber: room.roomNumber,
          status: room.status
        })),
        capacity: {
          adults: rt.maxAdult,
          children: rt.maxChild,
          total: totalCapacity,
          base: rt.baseAdult + rt.baseChild,
        },
        amenities: rt.roomAmenities || [],
        ratePlans: ratePlans.sort((a, b) => (a.price ?? 0) - (b.price ?? 0)),
      })
    }

    return response.ok({
      message: 'Availability retrieved successfully',
      meta: {
        hotelId,
        hotelName: hotel.hotelName,
        startDate: startDateStr,
        endDate: endDateStr,
        nights,
        adults,
        children,
      },
      data: data,
    })

  } catch (error) {
    console.error('Error in getAvailability:', error)
    return response.internalServerError({
      message: 'Error retrieving availability',
      error: error.message,
    })
  }
}

}
