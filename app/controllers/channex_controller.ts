import type { HttpContext } from '@adonisjs/core/http'
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import ReservationRoomService from '#services/reservation_room_service'
import Hotel from '#models/hotel'
import LoggerService from '#services/logger_service'

export default class ChannexController {
  private service: ChannexService

  constructor() {
    this.service = new ChannexService()
  }

  // GET /api/channex/properties/:propertyId/availability
  public async getAvailability({ params, request, response }: HttpContext) {
    try {
      const propertyId = params.propertyId
      const date_from = request.input('date_from')
      const date_to = request.input('date_to')    

      if (!propertyId || !date_from || !date_to) {
        return response.badRequest({
          message: 'propertyId, rate_plan_ids, date_from, and date_to are required',
        })
      }

      const data = await this.service.getAvailability(propertyId, {
        date_from,
        date_to,
      })

      return response.ok({ message: 'Availability fetched', data })
    } catch (error: any) {
      return response.internalServerError({ message: error.message || 'Failed to fetch availability' })
    }
  }

  // PUT /api/channex/properties/:propertyId/availability
  public async updateAvailability({ params, request, response }: HttpContext) {
    try {
      const propertyId = params.propertyId
      const payload = request.body()

      if (!propertyId) {
        return response.badRequest({ message: 'propertyId is required in route params' })
      }
      if (!payload?.values || !Array.isArray(payload.values)) {
        return response.badRequest({ message: 'Body must include a values array' })
      }

      const data = await this.service.updateAvailability(propertyId, payload)
      return response.ok({ message: 'Availability updated', data })
    } catch (error: any) {
      return response.internalServerError({ message: error.message || 'Failed to update availability' })
    }
  }

  // PUT /api/channex/properties/:propertyId/restrictions
  public async updateRestrictions({ params, request, response }: HttpContext) {
    try {
      const propertyId = params.propertyId
      const payload = request.body()

      if (!propertyId) {
        return response.badRequest({ message: 'propertyId is required in route params' })
      }
      if (!payload?.values || !Array.isArray(payload.values)) {
        return response.badRequest({ message: 'Body must include a values array' })
      }

      const data = await this.service.updateRestrictions(propertyId, payload)
      return response.ok({ message: 'Restrictions updated', data })
    } catch (error: any) {
      return response.internalServerError({ message: error.message || 'Failed to update restrictions' })
    }
  }

  // GET /api/channex/properties/:propertyId/room-types
  public async getRoomTypes({ params, response }: HttpContext) {
    try {
      const propertyId = params.propertyId

      if (!propertyId) {
        return response.badRequest({ message: 'propertyId is required' })
      }

      const data = await this.service.getRoomType(propertyId)
      return response.ok({ message: 'Room types fetched', data })
    } catch (error: any) {
      return response.internalServerError({
        message: error.message || 'Failed to fetch room types'
      })
    }
  }

  // GET /api/channex/properties/:propertyId/rate-plans
  public async getRatePlans({ params, response }: HttpContext) {
    try {
      const propertyId = params.propertyId

      if (!propertyId) {
        return response.badRequest({ message: 'propertyId is required' })
      }

      const data = await this.service.getRatePlan(propertyId)
      return response.ok({ message: 'Rate plans fetched', data })
    } catch (error: any) {
      return response.internalServerError({
        message: error.message || 'Failed to fetch rate plans'
      })
    }
  }

    // Ajouter cette méthode dans la classe ChannexController

  // GET /api/channex/properties/:propertyId/room-types-with-rate-plans
public async getRoomTypesWithRatePlans({ params, response }: HttpContext) {
  try {
    const propertyId = params.propertyId

    if (!propertyId) {
      return response.badRequest({ message: 'propertyId is required' })
    }

    // Récupérer les room types et rate plans en parallèle
    const [roomTypesData, ratePlansData] = await Promise.all([
      this.service.getRoomType(propertyId),
      this.service.getRatePlan(propertyId)
    ])

    // Helper to safely extract 'data' array
    const getArrayData = (data: unknown) => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'data' in data &&
        Array.isArray((data as any).data)
      ) {
        return (data as any).data
      }
      return []
    }

    const roomTypesArray = getArrayData(roomTypesData)
    const ratePlansArray = getArrayData(ratePlansData)

    // Grouper les room types et initialiser la structure.
    // Utiliser un objet simple pour le groupement (sans Map).
    // Clé: roomType.id, Valeur: { roomType: {...}, ratePlans: [] }
    let roomTypesObject: any= {}
    logger.info(ratePlansArray)
    // D'abord, initialiser tous les room types dans l'objet
    roomTypesArray.forEach((roomType: any) => {
      roomTypesObject[roomType.id] = {
        roomType: {
          id: roomType.id,
          title: roomType.attributes?.title || 'Unknown',
          occupancy: roomType.attributes?.occupancy || null,
          ...roomType.attributes
        },
        ratePlans: []
      }
    })

    // Ensuite, associer les rate plans aux room types
    ratePlansArray.forEach((ratePlan: any) => {
      const roomTypeId = ratePlan.relationships?.room_type?.data?.id
      logger.info(roomTypeId)
      logger.info( roomTypesObject[roomTypeId])
      // Vérifier si le room type existe dans l'objet de groupement
      if (roomTypeId && roomTypesObject[roomTypeId]) {
        // La structure est déjà une référence, donc la modification est directe
        roomTypesObject[roomTypeId].ratePlans.push({
          id: ratePlan.id,
          title: ratePlan.attributes?.title || 'Unknown',
          currency: ratePlan.attributes?.currency,
          options: ratePlan.attributes?.options || [],
          mealType: ratePlan.attributes?.meal_type,
          rateMode: ratePlan.attributes?.rate_mode,
          sellMode: ratePlan.attributes?.sell_mode,
          childrenFee: ratePlan.attributes?.children_fee,
          infantFee: ratePlan.attributes?.infant_fee,
          closedToArrival: ratePlan.attributes?.closed_to_arrival,
          closedToDeparture: ratePlan.attributes?.closed_to_departure,
          minStayArrival: ratePlan.attributes?.min_stay_arrival,
          minStayThrough: ratePlan.attributes?.min_stay_through,
          maxStay: ratePlan.attributes?.max_stay,
          stopSell: ratePlan.attributes?.stop_sell,
          cancellationPolicyId: ratePlan.attributes?.cancellation_policy_id,
          taxSetId: ratePlan.attributes?.tax_set_id
        })
      }
    })

    // Convertir l'objet en tableau de valeurs (similaire à Array.from(Map.values()))
    const result = Object.values(roomTypesObject)

    return response.ok({
      message: 'Room types with rate plans fetched',
      data: {
        propertyId,
        roomTypes: result,
        totalRoomTypes: result.length,
        totalRatePlans: ratePlansArray.length
      }
    })
  } catch (error: any) {
    return response.internalServerError({
      message: error.message || 'Failed to fetch room types with rate plans'
    })
  }
}

  // POST /api/channex/ari/update
  public async bulkUpdateARI(ctx: HttpContext) {
   const  { request, response, params } = ctx;
   const actorId = (ctx as any)?.auth?.user?.id ?? 0
    try {
      const body = request.body() || {}
      const propertyId = params.propertyId
      const dateRange: { from: string; to: string } = body.dateRange || body.dateRanges // single range expected
      const singleDate: string | undefined = body.date
      const days: string[] | undefined = body.days
      const selectedRooms: string[] = body.selectedRooms || []
      const selectedRates: string[] = body.selectedRates || []

      if (!propertyId) {
        return response.badRequest({ message: 'propertyId is required' })
      }
      // Enforce single date range (not a list)
      if (!dateRange || typeof dateRange !== 'object') {
        return response.badRequest({ message: 'dateRange is required and must be an object { from, to }' })
      }

      const hotel = await Hotel.query().where('channexPropertyId',propertyId).first()
      if (!hotel) {
        return response.notFound({ message: `Hotel ${hotel!.id} not found` })
      }
      if (!hotel.channexPropertyId) {
        return response.badRequest({ message: `Hotel ${hotel!.id} has no Channex property mapping` })
      }
      const hotelId = hotel.id


      // Log start of ARI bulk update
      await LoggerService.log({
        actorId,
        action: 'BULK_UPDATE_ARI_START',
        entityType: 'ChannexARI',
        entityId: propertyId,
        description: 'Starting ARI bulk update',
        hotelId: hotelId,
        meta: {
          date: singleDate ?? undefined,
          date_from: singleDate ? undefined : dateRange.from,
          date_to: singleDate ? undefined : dateRange.to,
          days: days ?? undefined,
          selectedRoomsCount: selectedRooms.length,
          selectedRatesCount: selectedRates.length,
        },
        ctx,
      })


      // Validate dates format YYYY-MM-DD
      const dateRe = /^\d{4}-\d{2}-\d{2}$/
      if (singleDate) {
        if (!dateRe.test(singleDate)) {
          return response.badRequest({ message: 'date must be in YYYY-MM-DD format' })
        }
      } else {
        if (!dateRange?.from || !dateRange?.to || !dateRe.test(dateRange.from) || !dateRe.test(dateRange.to)) {
          return response.badRequest({ message: 'dateRange must have from/to in YYYY-MM-DD format' })
        }
      }

      const checkIn = DateTime.fromISO(singleDate ?? dateRange.from).startOf('day')
      const checkOut = DateTime.fromISO(singleDate ?? dateRange.to).endOf('day')

      // Enforce non-past dates per Channex spec
      const today = DateTime.now().startOf('day')
      if (singleDate) {
        const d = DateTime.fromISO(singleDate).startOf('day')
        if (d < today) {
          return response.badRequest({ message: 'date must not be in the past' })
        }
      } else {
        const dFrom = DateTime.fromISO(dateRange.from).startOf('day')
        const dTo = DateTime.fromISO(dateRange.to).startOf('day')
        if (dFrom < today || dTo < today) {
          return response.badRequest({ message: 'date_from and date_to must not be in the past' })
        }
      }

      // Validate days values if provided
      const allowedDays = new Set(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'])
      if (days && days.length) {
        const invalid = days.filter((d) => !allowedDays.has(String(d).toLowerCase()))
        if (invalid.length) {
          return response.badRequest({ message: `days must be any of mo, tu, we, th, fr, sa, su. Invalid: ${invalid.join(', ')}` })
        }
      }

      // Build availability payload (compute availability server-side)
      const availabilityValues: {
        room_type_id: string
        property_id: string
        date_from: string
        date_to: string
        availability: number
      }[] = []

      if (selectedRooms.length > 0) {
        const RoomTypeModel = (await import('#models/room_type')).default
        // Prefetch room type mappings in bulk
        const roomTypes = await RoomTypeModel.query()
          .where('hotel_id', hotelId)
          .whereIn('channex_room_type_id', selectedRooms)
          .select(['id', 'channex_room_type_id'])

        const channexToRoomTypeId = new Map<string, number>()
        for (const rt of roomTypes) {
          // @ts-ignore model property mapping
          channexToRoomTypeId.set(rt.channexRoomTypeId || (rt as any).channex_room_type_id, rt.id)
        }

        const rrService = new ReservationRoomService()
        const localRoomTypeIds = Array.from(channexToRoomTypeId.values())
        const dailyCounts = await rrService.getDailyAvailableRoomCountsByRoomType(
          hotelId,
          localRoomTypeIds,
          checkIn.toJSDate(),
          checkOut.toJSDate()
        )

        const startDay = DateTime.fromISO(singleDate ?? dateRange.from).startOf('day')
        const endDay = DateTime.fromISO(singleDate ?? dateRange.to).startOf('day')
        for (const channexRoomTypeId of selectedRooms) {
          if (!channexRoomTypeId) continue
          const localId = channexToRoomTypeId.get(channexRoomTypeId)
          if (!localId) {
            logger.warn(`RoomType not mapped for hotel ${hotelId} channex_room_type_id=${channexRoomTypeId}`)
            continue
          }
          let segStart = startDay
          let current = dailyCounts[startDay.toISODate()!]?.[localId] ?? 0
          let cursor = startDay.plus({ days: 1 })
          while (cursor <= endDay) {
            const key = cursor.toISODate()!
            const val = dailyCounts[key]?.[localId] ?? 0
            if (val !== current) {
              availabilityValues.push({
                room_type_id: channexRoomTypeId,
                property_id: hotel.channexPropertyId,
                date_from: segStart.toISODate()!,
                date_to: cursor.minus({ days: 1 }).toISODate()!,
                availability: current,
              })
              segStart = cursor
              current = val
            }
            cursor = cursor.plus({ days: 1 })
          }
          availabilityValues.push({
            room_type_id: channexRoomTypeId,
            property_id: hotel.channexPropertyId,
            date_from: segStart.toISODate()!,
            date_to: endDay.toISODate()!,
            availability: current,
          })
        }
      }

      // Build restrictions payload (compute restrictions server-side)
      const restrictionValues: {
        rate_plan_id: string
        date_from: string
        date_to: string
        [key: string]: any
      }[] = []

      if (selectedRates.length > 0) {
        const RoomRateModel = (await import('#models/room_rate')).default
        // Prefetch all mapped room rates for selected rate plan IDs
        const roomRates = await RoomRateModel.query()
          .where('hotel_id', hotelId)
          .whereIn('channex_rate_id', selectedRates)
          .select([
            'channex_rate_id',
            'base_rate',
            'minimum_nights',
            'maximum_nights',
            'closed_to_arrival',
            'closed_to_departure',
            'stop_sell',
          ])

        const rateByChannexId = new Map<string, typeof roomRates[number]>()
        for (const rr of roomRates) {
          // @ts-ignore model property mapping
          const key = rr.channexRateId || (rr as any).channex_rate_id
          rateByChannexId.set(key, rr)
        }

        for (const channexRatePlanId of selectedRates) {
          if (!channexRatePlanId) continue
          const roomRate = rateByChannexId.get(channexRatePlanId)
          if (!roomRate) {
            logger.warn(`RoomRate not mapped for hotel ${hotelId} channex_rate_id=${channexRatePlanId}`)
            continue
          }
          // Build restrictions and drop undefined/null keys
          const restrictionsComputedRaw = {
            // Rate must be a decimal string or integer in minor units. Use decimal string.
            rate: String(Number((roomRate as any).baseRate).toFixed(2)),
            min_stay_arrival: roomRate.minimumNights ?? undefined,
            min_stay_through: roomRate.minimumNights ?? undefined,
            //min_stay: roomRate.minimumNights ?? undefined,
            max_stay: roomRate.maximumNights ?? undefined,
            // Send closed_to_arrival and closed_to_departure as 0/1
            closed_to_arrival:
              roomRate.closedToArrival === undefined
                ? undefined
                : (roomRate.closedToArrival ? 1 : 0),
            closed_to_departure:
              roomRate.closedToDeparture === undefined
                ? undefined
                : (roomRate.closedToDeparture ? 1 : 0),
            // Send stop_sell as 0/1 per instruction
            stop_sell:
              roomRate.stopSell === undefined
                ? undefined
                : (roomRate.stopSell ? 1 : 0),
          }
          const restrictionsComputed = Object.fromEntries(
            Object.entries(restrictionsComputedRaw).filter(([, v]) => v !== undefined && v !== null)
          )

          restrictionValues.push({
            // Channex restrictions require property_id and either date or date_from/date_to
            property_id: hotel.channexPropertyId,
            rate_plan_id: channexRatePlanId,
            // Always provide date_from/date_to to satisfy service typing
            ...(singleDate
              ? { date_from: singleDate, date_to: singleDate }
              : { date_from: dateRange.from, date_to: dateRange.to }),
            ...(days && days.length ? { days: days.map((d) => String(d).toLowerCase()) } : {}),
            ...restrictionsComputed,
          })
        }
      }

      // Execute updates concurrently when possible
      const tasks: Promise<any>[] = []
      if (availabilityValues.length > 0) {
        tasks.push(this.service.updateAvailability(hotel.channexPropertyId, { values: availabilityValues }))
      }

      console.log(restrictionValues)
      if (restrictionValues.length > 0) {
        // Ensure payload shape matches service signature: array of { values: [...] }
        tasks.push(this.service.updateRestrictions(hotel.channexPropertyId, { values: restrictionValues }))
      }

      if (tasks.length === 0) {
        return response.badRequest({ message: 'No availability or restrictions to update' })
      }

      const [availabilityRes, restrictionsRes] = await Promise.all(tasks)

      // Log success
      await LoggerService.log({
        actorId,
        action: 'BULK_UPDATE_ARI_SUCCESS',
        entityType: 'ChannexARI',
        entityId: propertyId,
        description: 'ARI bulk update completed',
        hotelId: hotelId,
        meta: {
          availabilityItems: availabilityValues,
          restrictionItems: restrictionValues,
          hasAvailabilityResponse: availabilityRes,
          hasRestrictionsResponse: restrictionsRes,
        },
        ctx,
      })

      return response.ok({
        message: 'ARI updates processed',
        data: {
          availability: availabilityRes || null,
          restrictions: restrictionsRes || null,
        },
      })
    } catch (error: any) {
      logger.error(error)
      // Log error
      try {
        await LoggerService.log({
          actorId,
          action: 'BULK_UPDATE_ARI_ERROR',
          entityType: 'ChannexARI',
          entityId: (params?.propertyId ?? 'unknown') as any,
          description: error?.message || 'Failed to update ARI',
          hotelId: undefined,
          meta: {
            stack: error?.stack,
          },
          ctx,
        })
      } catch {}
      return response.internalServerError({ message: error.message || 'Failed to update ARI' })
    }
  }

  // GET /api/channex/properties/:propertyId/bookings
  public async listBookings({ params, request, response }: HttpContext) {
    try {
      const propertyId = params.propertyId
      const page = Number(request.input('page', 1))
      const per_page = Number(request.input('per_page', 100))

      if (!propertyId) {
        return response.badRequest({ message: 'propertyId is required' })
      }

      const data = await this.service.listBookings(propertyId, { page, per_page })
      return response.ok({ message: 'Bookings fetched', data })
    } catch (error: any) {
      return response.internalServerError({ message: error.message || 'Failed to fetch bookings' })
    }
  }
}