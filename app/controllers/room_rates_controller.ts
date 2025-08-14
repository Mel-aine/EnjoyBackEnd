import type { HttpContext } from '@adonisjs/core/http'
import RoomRate from '#models/room_rate'
import { createRoomRateValidator, updateRoomRateValidator } from '#validators/room_rate'
import Database from '@adonisjs/lucid/services/db'

export default class RoomRatesController {
  /**
   * Display a list of room rates
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = request.input('hotel_id')
      const roomTypeId = request.input('room_type_id')
      const rateTypeId = request.input('rate_type_id')
      const seasonId = request.input('season_id')
      const sourceId = request.input('source_id')
      const status = request.input('status')
      const search = request.input('search')

      const query = RoomRate.query()
        .preload('hotel')
        .preload('roomType')
        .preload('rateType')
        .preload('season')
        .preload('source')
        .preload('creator')
        .preload('modifier')

      // Filter by hotel if provided
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      // Filter by room type if provided
      if (roomTypeId) {
        query.where('room_type_id', roomTypeId)
      }

      // Filter by rate type if provided
      if (rateTypeId) {
        query.where('rate_type_id', rateTypeId)
      }

      // Filter by season if provided
      if (seasonId) {
        query.where('season_id', seasonId)
      }

      // Filter by source if provided
      if (sourceId) {
        query.where('source_id', sourceId)
      }

      // Filter by status if provided
      if (status) {
        query.where('status', status)
      }

      // Search functionality
      if (search) {
        query.where((builder) => {
          builder
            .whereHas('roomType', (roomTypeQuery) => {
              roomTypeQuery.whereILike('room_type_name', `%${search}%`)
            })
            .orWhereHas('rateType', (rateTypeQuery) => {
              rateTypeQuery.whereILike('rate_type_name', `%${search}%`)
            })
            .orWhereHas('season', (seasonQuery) => {
              seasonQuery.whereILike('season_name', `%${search}%`)
            })
        })
      }

      query.orderBy('created_at', 'desc')

      const roomRates = await query.paginate(page, limit)

      return response.ok({
        message: 'Room rates retrieved successfully',
        data: roomRates
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve room rates',
        error: error.message
      })
    }
  }

  /**
   * Create a new room rate
   */
  async store({ request, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const payload = await request.validateUsing(createRoomRateValidator)
      const userId = auth.user?.id

      const roomRate = await RoomRate.create({
        ...payload,
        createdBy: userId!,
        lastModifiedBy: userId!
      }, { client: trx })

      await roomRate.load('hotel')
      await roomRate.load('roomType')
      await roomRate.load('rateType')
     // await roomRate.load('season')
     // await roomRate.load('source')
      await roomRate.load('creator')

      await trx.commit()

      return response.created({
        message: 'Room rate created successfully',
        data: roomRate
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to create room rate',
        error: error.message
      })
    }
  }

  /**
   * Show a specific room rate
   */
  async show({ params, response }: HttpContext) {
    try {
      const roomRate = await RoomRate.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('roomType')
        .preload('rateType')
        .preload('season')
        .preload('source')
        .preload('creator')
        .preload('modifier')
        .firstOrFail()

      return response.ok({
        message: 'Room rate retrieved successfully',
        data: roomRate
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Room rate not found' })
      }
      return response.badRequest({
        message: 'Failed to retrieve room rate',
        error: error.message
      })
    }
  }

  /**
   * Update a room rate
   */
  async update({ params, request, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const payload = await request.validateUsing(updateRoomRateValidator)
      const userId = auth.user?.id

      const roomRate = await RoomRate.query()
        .where('id', params.id)
        .forUpdate()
        .firstOrFail()

      roomRate.merge({
        ...payload,
        lastModifiedBy: userId!
      })

      await roomRate.save()

      await roomRate.load('hotel')
      await roomRate.load('roomType')
      await roomRate.load('rateType')
      await roomRate.load('season')
      await roomRate.load('source')
      await roomRate.load('modifier')

      await trx.commit()

      return response.ok({
        message: 'Room rate updated successfully',
        data: roomRate
      })
    } catch (error) {
      await trx.rollback()
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Room rate not found' })
      }
      return response.badRequest({
        message: 'Failed to update room rate',
        error: error.message
      })
    }
  }

  /**
   * Delete a room rate
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const roomRate = await RoomRate.findOrFail(params.id)
      await roomRate.delete()

      return response.ok({
        message: 'Room rate deleted successfully'
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Room rate not found' })
      }
      return response.badRequest({
        message: 'Failed to delete room rate',
        error: error.message
      })
    }
  }

  /**
   * Get room rates by date range
   */
  async getByDateRange({ request, response }: HttpContext) {
    try {
      const { startDate, endDate, roomTypeId, rateTypeId, seasonId, sourceId } = request.only([
        'startDate', 'endDate', 'roomTypeId', 'rateTypeId', 'seasonId', 'sourceId'
      ])

      const query = RoomRate.query()
        .preload('roomType')
        .preload('rateType')
        .preload('season')
        .preload('source')

      if (startDate && endDate) {
        query.where((builder) => {
          builder
            .whereBetween('effective_from', [startDate, endDate])
            .orWhereBetween('effective_to', [startDate, endDate])
            .orWhere((subBuilder) => {
              subBuilder
                .where('effective_from', '<=', startDate)
                .where('effective_to', '>=', endDate)
            })
        })
      }

      if (roomTypeId) {
        query.where('room_type_id', roomTypeId)
      }

      if (rateTypeId) {
        query.where('rate_type_id', rateTypeId)
      }

      if (seasonId) {
        query.where('season_id', seasonId)
      }

      if (sourceId) {
        query.where('source_id', sourceId)
      }

      query.where('status', 'active')
      query.orderBy('effective_from', 'asc')

      const roomRates = await query

      return response.ok({
        message: 'Room rates retrieved successfully',
        data: roomRates
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve room rates',
        error: error.message
      })
    }
  }

  /**
   * Get room rate statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotel_id')

      const query = RoomRate.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const [total, active, inactive] = await Promise.all([
        query.clone().count('* as total'),
        query.clone().where('status', 'active').count('* as total'),
        query.clone().where('status', 'inactive').count('* as total')
      ])

      const averageBaseRate = await query.clone().avg('base_rate as avg_rate')
      const minBaseRate = await query.clone().min('base_rate as min_rate')
      const maxBaseRate = await query.clone().max('base_rate as max_rate')

      return response.ok({
        message: 'Room rate statistics retrieved successfully',
        data: {
          total: Number(total[0].$extras.total),
          active: Number(active[0].$extras.active),
          inactive: Number(inactive[0].$extras.inactive),
          averageBaseRate: Number(averageBaseRate[0].$extras.avg_rate || 0),
          minBaseRate: Number(minBaseRate[0].$extras.min_rate || 0),
          maxBaseRate: Number(maxBaseRate[0].$extras.max_rate || 0)
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve room rate statistics',
        error: error.message
      })
    }
  }
}