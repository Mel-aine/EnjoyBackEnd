import type { HttpContext } from '@adonisjs/core/http'
import MarketCode from '#models/market_code'
import { createMarketCodeValidator, updateMarketCodeValidator } from '#validators/market_code'
import { DateTime } from 'luxon'

export default class MarketCodesController {
  /**
   * Display a list of market codes
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      const query = MarketCode.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      query.where('hotel_id', Number(hotelId))

      const marketCodes = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: marketCodes,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch market codes',
        error: error.message,
      })
    }
  }

  /**
   * Create a new market code
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createMarketCodeValidator)
      const user = auth.user!

      const marketCode = await MarketCode.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        isDeleted: false,
      })

      await marketCode.load('hotel')
      await marketCode.load('createdByUser')
      await marketCode.load('updatedByUser')

      return response.created({
        success: true,
        data: marketCode,
        message: 'Market code created successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create market code',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific market code
   */
  async show({ params, response }: HttpContext) {
    try {
      const marketCode = await MarketCode.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        success: true,
        data: marketCode,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Market code not found',
      })
    }
  }

  /**
   * Update a market code
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateMarketCodeValidator)
      const user = auth.user!

      const marketCode = await MarketCode.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      marketCode.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await marketCode.save()
      await marketCode.load('hotel')
      await marketCode.load('createdByUser')
      await marketCode.load('updatedByUser')

      return response.ok({
        success: true,
        data: marketCode,
        message: 'Market code updated successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update market code',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a market code
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const marketCode = await MarketCode.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      marketCode.merge({
        isDeleted: true,
        deletedAt:  DateTime.now(),
        updatedByUserId: user.id,
      })

      await marketCode.save()

      return response.ok({
        success: true,
        message: 'Market code deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete market code',
        error: error.message,
      })
    }
  }
}