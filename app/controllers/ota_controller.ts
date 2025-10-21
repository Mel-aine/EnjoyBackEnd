import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import RateType from '#models/rate_type'
import ReservationRoomService from '#services/reservation_room_service'

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
          address: {
            address: hotel.address,
            city: hotel.city,
            stateProvince: hotel.stateProvince,
            country: hotel.country,
            postalCode: hotel.postalCode,
          },
          contacts: {
            email: hotel.email,
            website: hotel.website,
            phoneNumber: hotel.phoneNumber,
          },
          policy: {
            checkInTime: hotel.checkInTime,
            checkOutTime: hotel.checkOutTime,
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
      const hotelId = Number(params.hotelId)
      if (isNaN(hotelId)) {
        return response.badRequest({ message: 'Invalid hotelId parameter' })
      }

      const startDateStr = request.input('startDate')
      const endDateStr = request.input('endDate')
      const adults = request.input('adults') ? Number(request.input('adults')) : undefined
      const children = request.input('children') ? Number(request.input('children')) : undefined

      if (!startDateStr || !endDateStr) {
        return response.badRequest({ message: 'startDate and endDate are required' })
      }

      const startDate = DateTime.fromISO(startDateStr)
      const endDate = DateTime.fromISO(endDateStr)

      if (!startDate.isValid || !endDate.isValid) {
        return response.badRequest({ message: 'Invalid date format. Use YYYY-MM-DD' })
      }
      if (endDate <= startDate) {
        return response.badRequest({ message: 'endDate must be after startDate' })
      }

      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .andWhere('is_deleted', false)
        .preload('rateTypes')
        .orderBy('sort_order', 'asc')

      const service = new ReservationRoomService()

      const data = [] as Array<{
        roomType: {
          id: number
          name: string
          shortCode: string
          baseCapacity: number
          maxCapacity: number
        }
        availableRooms: number
        rateTypes: Array<{ id: number; name: string; shortCode: string }>
      }>

      for (const rt of roomTypes) {
        const availableRooms = await service.findAvailableRooms(
          hotelId,
          startDate.toJSDate(),
          endDate.toJSDate(),
          rt.id,
          adults,
          children
        )

        data.push({
          roomType: {
            id: rt.id,
            name: rt.roomTypeName,
            shortCode: rt.shortCode,
            baseCapacity: rt.baseAdult + rt.baseChild,
            maxCapacity: rt.maxAdult + rt.maxChild,
          },
          availableRooms: availableRooms.length,
          rateTypes: (rt.rateTypes || []).map((r: RateType) => ({
            id: r.id,
            name: r.rateTypeName,
            shortCode: r.shortCode,
          })),
        })
      }

      return response.ok({
        message: 'Availability retrieved successfully',
        meta: {
          hotelId,
          startDate: startDate.toISODate(),
          endDate: endDate.toISODate(),
          adults: adults ?? null,
          children: children ?? null,
        },
        data,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Error retrieving availability',
        error: error.message,
      })
    }
  }
}