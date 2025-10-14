import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Unit from '#models/unit'
import { createUnitValidator, updateUnitValidator } from '#validators/unit'

export default class UnitsController {
  /**
   * Display a list of units
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const hotelId = params.hotelId
      if (!hotelId) {
        return response.badRequest({
          message: 'hotelId is required in route params',
        })
      }

      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search', '')

      const query = Unit.query()
        .where('is_deleted', false)
        .where('hotel_id', hotelId)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      if (search) {
        query.where((builder) => {
          builder.whereILike('name', `%${search}%`)
        })
      }

      query.orderBy('created_at', 'desc')

      const units = await query.paginate(page, limit)

      return response.ok({
        message: 'Units retrieved successfully',
        data: units,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve units',
        error: error.message,
      })
    }
  }

  /**
   * Create a new unit
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createUnitValidator)
      const user = auth.user!

      // Check for duplicate name within hotel
      const existing = await Unit.query()
        .where('hotel_id', payload.hotelId)
        .where('name', payload.name)
        .where('is_deleted', false)
        .first()

      if (existing) {
        return response.conflict({
          message: 'A unit with this name already exists for this hotel',
        })
      }

      const unit = await Unit.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      })

      await unit.load('hotel')
      await unit.load('createdByUser')
      await unit.load('updatedByUser')

      return response.created({
        message: 'Unit created successfully',
        data: unit,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create unit',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific unit
   */
  async show({ params, response }: HttpContext) {
    try {
      const unit = await Unit.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        message: 'Unit retrieved successfully',
        data: unit,
      })
    } catch (error) {
      return response.notFound({
        message: 'Unit not found',
      })
    }
  }

  /**
   * Update a unit
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateUnitValidator)
      const user = auth.user!

      const unit = await Unit.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      // Check for duplicate name excluding current record
      if (payload.name) {
        const existing = await Unit.query()
          .where('name', payload.name)
          .where('hotel_id', payload.hotelId || unit.hotelId)
          .where('is_deleted', false)
          .whereNot('id', unit.id)
          .first()

        if (existing) {
          return response.conflict({
            message: 'A unit with this name already exists for this hotel',
          })
        }
      }

      unit.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await unit.save()
      await unit.load('hotel')
      await unit.load('createdByUser')
      await unit.load('updatedByUser')

      return response.ok({
        message: 'Unit updated successfully',
        data: unit,
      })
    } catch (error) {
      if ((error as any).code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Unit not found',
        })
      }
      return response.badRequest({
        message: 'Failed to update unit',
        error: (error as any).message,
      })
    }
  }

  /**
   * Soft delete a unit
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const unit = await Unit.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      unit.merge({
        isDeleted: true,
        deletedAt: DateTime.now(),
        updatedByUserId: user.id,
      })

      await unit.save()

      return response.ok({
        message: 'Unit deleted successfully',
      })
    } catch (error) {
      if ((error as any).code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Unit not found',
        })
      }
      return response.internalServerError({
        message: 'Failed to delete unit',
        error: (error as any).message,
      })
    }
  }

  /**
   * Restore a soft-deleted unit
   */
  async restore({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const unit = await Unit.query()
        .where('id', params.id)
        .where('is_deleted', true)
        .firstOrFail()

      unit.merge({
        isDeleted: false,
        deletedAt: null,
        updatedByUserId: user.id,
      })

      await unit.save()
      await unit.load('hotel')
      await unit.load('createdByUser')
      await unit.load('updatedByUser')

      return response.ok({
        message: 'Unit restored successfully',
        data: unit,
      })
    } catch (error) {
      if ((error as any).code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Deleted unit not found',
        })
      }
      return response.internalServerError({
        message: 'Failed to restore unit',
        error: (error as any).message,
      })
    }
  }
}