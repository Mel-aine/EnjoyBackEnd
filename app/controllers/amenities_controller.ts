import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'
import Amenity from '#models/amenity'
import { createAmenityValidator, updateAmenityValidator } from '#validators/amenity'

export default class AmenitiesController {
  /**
   * Display a list of amenities
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId
      const amenityType = request.input('amenity_type')
      const includeDeleted = request.input('include_deleted', false)

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      let query = includeDeleted ? Amenity.scopeWithDeleted() : Amenity.scopeActive()

      // Apply filters
    query = query.where('hotel_id', Number(hotelId))

    if (amenityType) {
      query = query.where('amenity_type', amenityType)
    }

    const status = request.input('status')
    if (status) {
      query = query.where('status', status)
    }

      // Include relationships
      query = query.preload('hotel').preload('createdByUser').preload('updatedByUser')

      // Order by sort key and name
      query = query.orderBy('sort_key', 'asc').orderBy('amenity_name', 'asc')

      const amenities = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: amenities,
        message: 'Amenities retrieved successfully'
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error retrieving amenities',
        error: error.message
      })
    }
  }

  /**
   * Show a specific amenity
   */
  async show({ params, response }: HttpContext) {
    try {
      const amenity = await Amenity.scopeActive()
        .where('id', params.id)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        success: true,
        data: amenity,
        message: 'Amenity retrieved successfully'
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Amenity not found',
        error: error.message
      })
    }
  }

  /**
   * Create a new amenity
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createAmenityValidator)
      const user = auth.user!

      const amenity = await Amenity.create({
        ...payload,
        status: payload.status || 'active',
        createdByUserId: user.id,
        updatedByUserId: user.id
      })

      await amenity.load('hotel')
      await amenity.load('createdByUser')

      await LoggerService.log({
        actorId: user.id,
        action: 'CREATE',
        entityType: 'Amenity',
        entityId: amenity.id,
        hotelId: amenity.hotelId,
        description: `Created amenity: ${amenity.amenityName}`,
        changes: amenity.serialize(),
        ctx: { request, response } as any
      })

      return response.created({
        success: true,
        data: amenity,
        message: 'Amenity created successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Error creating amenity',
        error: error.message
      })
    }
  }

  /**
   * Update an existing amenity
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateAmenityValidator)
      const user = auth.user!

      const amenity = await Amenity.findOrFail(params.id)
      const oldData = amenity.serialize()
      
      amenity.merge({
        ...payload,
        updatedByUserId: user.id
      })
      
      await amenity.save()
      await amenity.load('hotel')
      await amenity.load('updatedByUser')

      await LoggerService.log({
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'Amenity',
        entityId: amenity.id,
        hotelId: amenity.hotelId,
        description: `Updated amenity: ${amenity.amenityName}`,
        changes: LoggerService.extractChanges(oldData, amenity.serialize()),
        ctx: { request, response } as any
      })

      return response.ok({
        success: true,
        data: amenity,
        message: 'Amenity updated successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Error updating amenity',
        error: error.message
      })
    }
  }

  /**
   * Soft delete an amenity
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const amenity = await Amenity.findOrFail(params.id)
      
      await amenity.softDelete(user.id)

      return response.ok({
        success: true,
        message: 'Amenity deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Error deleting amenity',
        error: error.message
      })
    }
  }

  /**
   * Restore a soft-deleted amenity
   */
  async restore({ params, request, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const amenity = await Amenity.scopeOnlyDeleted().where('id', params.id).firstOrFail()
      
      await amenity.restore(user.id)
      await amenity.load('hotel')
      await amenity.load('updatedByUser')

      await LoggerService.log({
        actorId: user.id,
        action: 'RESTORE',
        entityType: 'Amenity',
        entityId: amenity.id,
        hotelId: amenity.hotelId,
        description: `Restored amenity: ${amenity.amenityName}`,
        ctx: { request, response } as any
      })

      return response.ok({
        success: true,
        data: amenity,
        message: 'Amenity restored successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Error restoring amenity',
        error: error.message
      })
    }
  }

  /**
   * Permanently delete an amenity
   */
  async forceDelete({ params, response }: HttpContext) {
    try {
      const amenity = await Amenity.scopeWithDeleted().where('id', params.id).firstOrFail()
      await amenity.delete()

      return response.ok({
        success: true,
        message: 'Amenity permanently deleted'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Error permanently deleting amenity',
        error: error.message
      })
    }
  }

  /**
   * Get amenities by hotel
   */
  async getByHotel({ params, request, response }: HttpContext) {
    try {
      const hotelId = params.hotel_id
      const amenityType = request.input('amenity_type')
      const status = request.input('status')
      
      let query = Amenity.scopeActive().where('hotel_id', hotelId)
      
      if (amenityType) {
        query = query.where('amenity_type', amenityType)
      }
      
      if (status) {
        query = query.where('status', status)
      }
      
      const amenities = await query
        .orderBy('sort_key', 'asc')
        .orderBy('amenity_name', 'asc')

      return response.ok({
        success: true,
        data: amenities,
        message: 'Hotel amenities retrieved successfully'
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error retrieving hotel amenities',
        error: error.message
      })
    }
  }

  /**
   * Update sort order for amenities
   */
  async updateSortOrder({ request, response, auth }: HttpContext) {
    try {
      const { amenities } = request.only(['amenities'])
      const user = auth.user!

      // amenities should be an array of { id, sort_key }
      let hotelId = 0
      for (const amenityData of amenities) {
        const amenity = await Amenity.findOrFail(amenityData.id)
        if (hotelId === 0) hotelId = amenity.hotelId
        amenity.sortKey = amenityData.sort_key
        amenity.updatedByUserId = user.id
        await amenity.save()
      }

      if (hotelId !== 0) {
        await LoggerService.log({
          actorId: user.id,
          action: 'UPDATE_SORT_ORDER',
          entityType: 'Amenity',
          entityId: 0,
          hotelId: hotelId,
          description: `Updated sort order for amenities`,
          ctx: { request, response } as any
        })
      }

      return response.ok({
        success: true,
        message: 'Sort order updated successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Error updating sort order',
        error: error.message
      })
    }
  }
}