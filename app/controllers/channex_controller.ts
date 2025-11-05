import type { HttpContext } from '@adonisjs/core/http'
import { ChannexService } from '#services/channex_service'

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
}