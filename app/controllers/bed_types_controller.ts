import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import BedType from '#models/bed_type'
import { createBedTypeValidator, updateBedTypeValidator } from '#validators/bed_type'

export default class BedTypesController {
  /**
   * Display a list of bed types
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

      const query = BedType.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdBy')
        .preload('updatedBy')

      if (search) {
        query.where((builder) => {
          builder
            .whereILike('bed_type_name', `%${search}%`)
            .orWhereILike('short_code', `%${search}%`)
        })
      }

      query.where('hotel_id', hotelId)

      query.orderBy('created_at', 'desc')

      const bedTypes = await query.paginate(page, limit)

      return response.ok({
        message: 'Bed types retrieved successfully',
        data: bedTypes,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve bed types',
        error: error.message,
      })
    }
  }

  /**
   * Create a new bed type
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createBedTypeValidator)
      const user = auth.user!

      // Check if short code already exists for this hotel
      const existingBedType = await BedType.query()
        .where('short_code', payload.shortCode)
        .where('hotel_id', payload.hotelId)
        .where('is_deleted', false)
        .first()

      if (existingBedType) {
        return response.conflict({
          message: 'A bed type with this short code already exists for this hotel',
        })
      }

      const bedType = await BedType.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      })

      await bedType.load('hotel')
      await bedType.load('createdBy')
      await bedType.load('updatedBy')

      return response.created({
        message: 'Bed type created successfully',
        data: bedType,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create bed type',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific bed type
   */
  async show({ params, response }: HttpContext) {
    try {
      const bedType = await BedType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdBy')
        .preload('updatedBy')
        .firstOrFail()

      return response.ok({
        message: 'Bed type retrieved successfully',
        data: bedType,
      })
    } catch (error) {
      return response.notFound({
        message: 'Bed type not found',
      })
    }
  }

  /**
   * Update a bed type
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateBedTypeValidator)
      const user = auth.user!

      const bedType = await BedType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      // Check if short code already exists for this hotel (excluding current record)
      if (payload.shortCode) {
        const existingBedType = await BedType.query()
          .where('short_code', payload.shortCode)
          .where('hotel_id', payload.hotelId || bedType.hotelId)
          .where('is_deleted', false)
          .whereNot('id', bedType.id)
          .first()

        if (existingBedType) {
          return response.conflict({
            message: 'A bed type with this short code already exists for this hotel',
          })
        }
      }

      bedType.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await bedType.save()
      await bedType.load('hotel')
      await bedType.load('createdBy')
      await bedType.load('updatedBy')

      return response.ok({
        message: 'Bed type updated successfully',
        data: bedType,
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Bed type not found',
        })
      }
      return response.badRequest({
        message: 'Failed to update bed type',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a bed type
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const bedType = await BedType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      bedType.merge({
        isDeleted: true,
        deletedAt: DateTime.now(),
        updatedByUserId: user.id,
      })

      await bedType.save()

      return response.ok({
        message: 'Bed type deleted successfully',
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Bed type not found',
        })
      }
      return response.internalServerError({
        message: 'Failed to delete bed type',
        error: error.message,
      })
    }
  }

  /**
   * Restore a soft-deleted bed type
   */
  async restore({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const bedType = await BedType.query()
        .where('id', params.id)
        .where('is_deleted', true)
        .firstOrFail()

      bedType.merge({
        isDeleted: false,
        deletedAt: null,
        updatedByUserId: user.id,
      })

      await bedType.save()
      await bedType.load('hotel')
      await bedType.load('createdBy')
      await bedType.load('updatedBy')

      return response.ok({
        message: 'Bed type restored successfully',
        data: bedType,
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Deleted bed type not found',
        })
      }
      return response.internalServerError({
        message: 'Failed to restore bed type',
        error: error.message,
      })
    }
  }

  /**
   * Toggle bed type status between Active and Inactive
   */
  async toggleStatus({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const bedType = await BedType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      const newStatus = bedType.status === 'Active' ? 'Inactive' : 'Active'

      bedType.merge({
        status: newStatus,
        updatedByUserId: user.id,
      })

      await bedType.save()
      await bedType.load('hotel')
      await bedType.load('createdBy')
      await bedType.load('updatedBy')

      return response.ok({
        message: `Bed type status changed to ${newStatus} successfully`,
        data: bedType,
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Bed type not found',
        })
      }
      return response.internalServerError({
        message: 'Failed to toggle bed type status',
        error: error.message,
      })
    }
  }
}