import type { HttpContext } from '@adonisjs/core/http'
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'

export default class ChannexController {
  private service: ChannexService

  constructor() {
    this.service = new ChannexService()
  }

  // GET /api/channex/properties/:propertyId/availability
  public async getAvailability({ params, request, response }: HttpContext) {
    try {
      const propertyId = params.propertyId
      const ratePlanIdsInput = request.input('rate_plan_ids')
      const date_from = request.input('date_from')
      const date_to = request.input('date_to')

      let rate_plan_ids: string[] = []
      if (Array.isArray(ratePlanIdsInput)) {
        rate_plan_ids = ratePlanIdsInput
      } else if (typeof ratePlanIdsInput === 'string') {
        rate_plan_ids = ratePlanIdsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      }

      if (!propertyId || !date_from || !date_to || rate_plan_ids.length === 0) {
        return response.badRequest({
          message: 'propertyId, rate_plan_ids, date_from, and date_to are required',
        })
      }

      const data = await this.service.getAvailability(propertyId, {
        rate_plan_ids,
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
}