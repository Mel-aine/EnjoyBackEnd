import type { HttpContext } from '@adonisjs/core/http'
import RoomType from '#models/room_type'
import { createRoomTypeValidator, updateRoomTypeValidator } from '#validators/room_type'

export default class RoomTypesController {
  /**
   * Display a list of room types
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const hotelId = request.input('hotel_id')
      const status = request.input('status')
      const bedType = request.input('bed_type')
      const smokingAllowed = request.input('smoking_allowed')
      const petFriendly = request.input('pet_friendly')

      const query = RoomType.query()

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      if (search) {
        query.where((builder) => {
          builder
            .where('type_name', 'ILIKE', `%${search}%`)
            .orWhere('type_code', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
        })
      }

      if (status) {
        query.where('status', status)
      }

      if (bedType) {
        query.where('bed_type', bedType)
      }

      if (smokingAllowed !== undefined) {
        query.where('smoking_allowed', smokingAllowed)
      }

      if (petFriendly !== undefined) {
        query.where('pet_friendly', petFriendly)
      }

      const roomTypes = await query
        .preload('hotel')
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
        createdBy: auth.user?.id
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
        lastModifiedBy: auth.user?.id
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
  async destroy({ params, response }: HttpContext) {
    try {
      const roomType = await RoomType.findOrFail(params.id)
      
      // Check if there are any rooms of this type
      const roomsCount = await roomType.related('rooms').query().count('* as total')
      if (roomsCount[0].$extras.total > 0) {
        return response.badRequest({
          message: 'Cannot delete room type with existing rooms'
        })
      }

      await roomType.delete()

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
   * Toggle room type status
   */
  async toggleStatus({ params, response, auth }: HttpContext) {
    try {
      const roomType = await RoomType.findOrFail(params.id)
      
      roomType.status = roomType.status === 'active' ? 'inactive' : 'active'
      roomType.lastModifiedBy = auth.user?.id!
      
      await roomType.save()

      return response.ok({
        message: `Room type ${roomType.status === 'active' ? 'activated' : 'deactivated'} successfully`,
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
   * Update room type sort order
   */
  async updateSortOrder({ request, response, auth }: HttpContext) {
    try {
      const { roomTypes } = request.only(['roomTypes'])
      
      if (!Array.isArray(roomTypes)) {
        return response.badRequest({
          message: 'Room types array is required'
        })
      }

      for (const item of roomTypes) {
        await RoomType.query()
          .where('id', item.id)
          .update({
            sortOrder: item.sortOrder,
            lastModifiedBy: auth.user?.id
          })
      }

      return response.ok({
        message: 'Room type sort order updated successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update sort order',
        error: error.message
      })
    }
  }
}