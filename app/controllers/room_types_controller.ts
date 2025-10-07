import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import RoomType from '#models/room_type'
import { createRoomTypeValidator, updateRoomTypeValidator, updateSortOrderValidator } from '#validators/room_type'

export default class RoomTypesController {
  /**
   * Display a list of room types
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const hotelId = params.hotelId
      if (!hotelId) {
        return response.badRequest({
          message: 'hotelId is required in route params'
        })
      }
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')

      const query = RoomType.query()

      query.where('hotel_id', hotelId)

      if (search) {
        query.where((builder) => {
          builder
            .where('room_type_name', 'ILIKE', `%${search}%`)
            .orWhere('short_code', 'ILIKE', `%${search}%`)
        })
      }

      // Add soft delete filter
      query.where('is_deleted', false)

      const roomTypes = await query
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .orderBy('sort_order', 'asc')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.ok({
        message: 'Room types retrieved successfully',
        data: roomTypes
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve room types',
        error: error.message
      })
    }
  }

  /**
   * Create a new room type
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createRoomTypeValidator)

      const roomType = await RoomType.create({
        ...payload,
        createdByUserId: auth.user?.id
      })

      await roomType.load('hotel')

      return response.created({
        message: 'Room type created successfully',
        data: roomType
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create room type',
        error: error.message
      })
    }
  }

  /**
   * Show a specific room type
   */
  async show({ params, response }: HttpContext) {
    try {
      const roomType = await RoomType.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('rooms')
        .preload('roomRates')
        .firstOrFail()

      return response.ok({
        message: 'Room type retrieved successfully',
        data: roomType
      })
    } catch (error) {
      return response.notFound({
        message: 'Room type not found',
        error: error.message
      })
    }
  }

  /**
   * Update a room type
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const roomType = await RoomType.findOrFail(params.id)
      const payload = await request.validateUsing(updateRoomTypeValidator)

      roomType.merge({
        ...payload,
        updatedByUserId: auth.user?.id
      })

      await roomType.save()
      await roomType.load('hotel')

      return response.ok({
        message: 'Room type updated successfully',
        data: roomType
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update room type',
        error: error.message
      })
    }
  }

  /**
   * Delete a room type
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const roomType = await RoomType.findOrFail(params.id)

      // Check if there are any rooms of this type
      const roomsCount = await roomType.related('rooms').query().count('* as total')
      if (roomsCount[0].$extras.total > 0) {
        return response.badRequest({
          message: 'Cannot delete room type with existing rooms'
        })
      }

      // Soft delete
      roomType.isDeleted = true
      roomType.deletedAt = DateTime.now()
      roomType.updatedByUserId = auth.user?.id!
      await roomType.save()

      return response.ok({
        message: 'Room type deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete room type',
        error: error.message
      })
    }
  }

  /**
   * Get room type availability
   */
  async availability({ params, request, response }: HttpContext) {
    try {
      const roomType = await RoomType.findOrFail(params.id)
      const { checkIn, checkOut } = request.only(['checkIn', 'checkOut'])

      if (!checkIn || !checkOut) {
        return response.badRequest({
          message: 'Check-in and check-out dates are required'
        })
      }

      const totalRooms = await roomType.related('rooms')
        .query()
        .where('status', 'available')
        .count('* as total')

      // This would need more complex logic to check actual availability
      // based on reservations, but for now we'll return basic info
      const availability = {
        roomType,
        totalRooms: totalRooms[0].$extras.total,
        availableRooms: totalRooms[0].$extras.total, // Simplified
        checkIn,
        checkOut
      }

      return response.ok({
        message: 'Room type availability retrieved successfully',
        data: availability
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve availability',
        error: error.message
      })
    }
  }

  /**
   * Get room type statistics
   */
  async stats({ params, response }: HttpContext) {
    try {
      const roomType = await RoomType.findOrFail(params.id)

      const totalRooms = await roomType.related('rooms').query().count('* as total')
      const availableRooms = await roomType.related('rooms')
        .query()
        .where('status', 'available')
        .count('* as total')
      const occupiedRooms = await roomType.related('rooms')
        .query()
        .where('status', 'occupied')
        .count('* as total')
      const outOfOrderRooms = await roomType.related('rooms')
        .query()
        .where('status', 'out_of_order')
        .count('* as total')
      const maintenanceRooms = await roomType.related('rooms')
        .query()
        .where('status', 'maintenance')
        .count('* as total')

      const stats = {
        totalRooms: totalRooms[0].$extras.total,
        availableRooms: availableRooms[0].$extras.total,
        occupiedRooms: occupiedRooms[0].$extras.total,
        outOfOrderRooms: outOfOrderRooms[0].$extras.total,
        maintenanceRooms: maintenanceRooms[0].$extras.total,
        occupancyRate: totalRooms[0].$extras.total > 0 ?
          (occupiedRooms[0].$extras.total / totalRooms[0].$extras.total * 100).toFixed(2) : 0
      }

      return response.ok({
        message: 'Room type statistics retrieved successfully',
        data: stats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message
      })
    }
  }

  /**
   * Toggle room type publish status
   */
  async toggleStatus({ params, response, auth }: HttpContext) {
    try {
      const roomType = await RoomType.findOrFail(params.id)

      roomType.publishToWebsite = !roomType.publishToWebsite
      roomType.updatedByUserId = auth.user?.id!

      await roomType.save()

      return response.ok({
        message: `Room type ${roomType.publishToWebsite ? 'published to website' : 'unpublished from website'} successfully`,
        data: roomType
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to toggle room type status',
        error: error.message
      })
    }
  }

  /**
   * Restore a soft-deleted room type
   */
  async restore({ params, response, auth }: HttpContext) {
    try {
      const roomType = await RoomType.query()
        .where('id', params.id)
        .where('is_deleted', true)
        .firstOrFail()

      roomType.isDeleted = false
      roomType.deletedAt = null
      roomType.updatedByUserId = auth.user?.id!

      await roomType.save()

      return response.ok({
        message: 'Room type restored successfully',
        data: roomType
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to restore room type',
        error: error.message
      })
    }
  }

  /**
   * Update sort order for multiple room types
   */
  async updateSortOrder({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateSortOrderValidator)
      const userId = auth.user?.id

      // Update each room type's sort order
      for (const roomTypeData of payload) {
        const roomType = await RoomType.findOrFail(roomTypeData.id)
        roomType.sortOrder = roomTypeData.sortOrder
        roomType.updatedByUserId = userId!
        await roomType.save()
      }

      return response.ok({
        message: 'Sort order updated successfully',
        data: payload
      })
    } catch (error) {
      if ((error as any)?.code === 'E_VALIDATION_ERROR' || (error as any)?.code === 'E_VALIDATION_FAILURE' || (error as any)?.messages) {
        return response.badRequest({
          message: 'Failed to update sort order',
          error: 'Validation failure',
          errors: (error as any).messages
        })
      }
      return response.badRequest({
        message: 'Failed to update sort order',
        error: (error as any)?.message || 'Unknown error'
      })
    }
  }

  /**
   * Get roomtype for a hotel // Récupérer tous les types de chambres pour un hôtel donné
   */
  async showByHotel({ params, request, response }: HttpContext) {
    try {
      const hotelId = Number(params.id)
      console.log('Fetching room types for hotelId:', hotelId)

      if (isNaN(hotelId)) {
        return response.badRequest({ message: 'Invalid hotelId parameter' })
      }

      // Récupérer la page et la limite depuis les query params, sinon valeurs par défaut
      const page = Number(request.input('page', 1))
      const limit = Number(request.input('limit', 10))

      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .andWhere('is_deleted', false)
        .preload('rooms',(query)=>{
          query.preload('taxRates')
        })
        .preload('roomRates')
        .orderBy('sort_order', 'asc')
        .paginate(page, limit)

      // Vérifier si aucun résultat
      if (roomTypes.total === 0) {
        return response.notFound({
          message: `No room types found for hotel ID ${hotelId}`
        })
      }

      return response.ok({
        message: 'Room types retrieved successfully',
        data: roomTypes.toJSON(),
      })
    } catch (error) {
      console.error(error)
      return response.internalServerError({
        message: 'Error retrieving room types',
        error: error.message
      })
    }
  }


}
