import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Season from '#models/season'
import { createSeasonValidator, updateSeasonValidator } from '#validators/season'
import Database from '@adonisjs/lucid/services/db'

export default class SeasonsController {
  /**
   * Get all seasons with filtering and pagination
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = request.input('hotel_id')
      const search = request.input('search')
      const status = request.input('status')
      const includeDeleted = request.input('include_deleted', false)

      const query = Season.query()
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      // Filter by hotel if provided
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      // Search functionality
      if (search) {
        query.where((builder) => {
          builder
            .where('short_code', 'ILIKE', `%${search}%`)
            .orWhere('season_name', 'ILIKE', `%${search}%`)
        })
      }

      // Filter by status
      if (status) {
        query.where('status', status)
      }

      // Handle soft deletes
      if (!includeDeleted) {
        query.where('is_deleted', false)
      }

      const seasons = await query.paginate(page, limit)

      return response.ok({
        message: 'Seasons retrieved successfully',
        data: seasons
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve seasons',
        error: error.message
      })
    }
  }

  /**
   * Create a new season
   */
  async store({ request, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const payload = await request.validateUsing(createSeasonValidator)
      const userId = auth.user?.id

      // Check for duplicate short code within the same hotel
      const existingSeason = await Season.query()
        .where('hotel_id', payload.hotelId)
        .where('short_code', payload.shortCode)
        .where('is_deleted', false)
        .first()

      if (existingSeason) {
        await trx.rollback()
        return response.conflict({
          message: 'Season with this short code already exists for this hotel'
        })
      }

      const season = await Season.create({
        hotelId: payload.hotelId,
        shortCode: payload.shortCode,
        seasonName: payload.seasonName,
        fromDay: payload.fromDay,
        fromMonth: payload.fromMonth,
        toDay: payload.toDay,
        toMonth: payload.toMonth,
        startDate: DateTime.fromJSDate(payload.startDate),
        status: payload.status || 'active',
        createdByUserId: userId!,
        updatedByUserId: userId!
      }, { client: trx })

      await season.load('hotel')
      await season.load('createdByUser')

      await trx.commit()

      return response.created({
        message: 'Season created successfully',
        data: season
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to create season',
        error: error.message
      })
    }
  }

  /**
   * Get a specific season by ID
   */
  async show({ params, response }: HttpContext) {
    try {
      const season = await Season.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        message: 'Season retrieved successfully',
        data: season
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Season not found' })
      }
      return response.badRequest({
        message: 'Failed to retrieve season',
        error: error.message
      })
    }
  }

  /**
   * Update an existing season
   */
  async update({ params, request, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const payload = await request.validateUsing(updateSeasonValidator)
      const userId = auth.user?.id

      const season = await Season.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .forUpdate()
        .firstOrFail()

      // Check for duplicate short code if updating short code
      if (payload.shortCode && payload.shortCode !== season.shortCode) {
        const existingSeason = await Season.query()
          .where('hotel_id', payload.hotelId || season.hotelId)
          .where('short_code', payload.shortCode)
          .where('is_deleted', false)
          .whereNot('id', params.id)
          .first()

        if (existingSeason) {
          await trx.rollback()
          return response.conflict({
            message: 'Season with this short code already exists for this hotel'
          })
        }
      }

      // Update fields
      if (payload.hotelId !== undefined) season.hotelId = payload.hotelId
      if (payload.shortCode !== undefined) season.shortCode = payload.shortCode
      if (payload.seasonName !== undefined) season.seasonName = payload.seasonName
      if (payload.fromDay !== undefined) season.fromDay = payload.fromDay
      if (payload.fromMonth !== undefined) season.fromMonth = payload.fromMonth
      if (payload.toDay !== undefined) season.toDay = payload.toDay
      if (payload.toMonth !== undefined) season.toMonth = payload.toMonth
      if (payload.startDate !== undefined) season.startDate = DateTime.fromJSDate(payload.startDate)
      if (payload.status !== undefined) season.status = payload.status
      
      season.updatedByUserId = userId!

      await season.save()
      await season.load('hotel')
      await season.load('updatedByUser')

      await trx.commit()

      return response.ok({
        message: 'Season updated successfully',
        data: season
      })
    } catch (error) {
      await trx.rollback()
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Season not found' })
      }
      return response.badRequest({
        message: 'Failed to update season',
        error: error.message
      })
    }
  }

  /**
   * Soft delete a season
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const userId = auth.user?.id
      const season = await Season.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      season.isDeleted = true
      season.updatedByUserId = userId!
      await season.save()

      return response.ok({
        message: 'Season deleted successfully'
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Season not found' })
      }
      return response.badRequest({
        message: 'Failed to delete season',
        error: error.message
      })
    }
  }

  /**
   * Restore a soft-deleted season
   */
  async restore({ params, response, auth }: HttpContext) {
    try {
      const userId = auth.user?.id
      const season = await Season.query()
        .where('id', params.id)
        .where('is_deleted', true)
        .firstOrFail()

      season.isDeleted = false
      season.deletedAt = null
      season.updatedByUserId = userId!
      await season.save()

      await season.load('hotel')
      await season.load('updatedByUser')

      return response.ok({
        message: 'Season restored successfully',
        data: season
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Deleted season not found' })
      }
      return response.badRequest({
        message: 'Failed to restore season',
        error: error.message
      })
    }
  }

  /**
   * Get season statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotel_id')

      const query = Season.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const [total, active, inactive, draft, deleted] = await Promise.all([
        query.clone().where('is_deleted', false).count('* as total'),
        query.clone().where('is_deleted', false).where('status', 'active').count('* as total'),
        query.clone().where('is_deleted', false).where('status', 'inactive').count('* as total'),
        query.clone().where('is_deleted', false).where('status', 'draft').count('* as total'),
        query.clone().where('is_deleted', true).count('* as total')
      ])

      return response.ok({
        message: 'Season statistics retrieved successfully',
        data: {
          total: Number(total[0].$extras.total),
          active: Number(active[0].$extras.total),
          inactive: Number(inactive[0].$extras.total),
          draft: Number(draft[0].$extras.total),
          deleted: Number(deleted[0].$extras.total)
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve season statistics',
        error: error.message
      })
    }
  }
}