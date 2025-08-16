import type { HttpContext } from '@adonisjs/core/http'
import RoomOwner from '#models/room_owner'
import Room from '#models/room'
import User from '#models/user'
import { createRoomOwnerValidator, updateRoomOwnerValidator, assignRoomsValidator } from '#validators/room_owner'
import db from '@adonisjs/lucid/services/db'

export default class RoomOwnersController {
  /**
   * Display a list of room owners
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search', '')
      const includeDeleted = request.input('includeDeleted', false)

      let query = includeDeleted ? RoomOwner.withDeleted() : RoomOwner.withoutDeleted()

      query = query.preload('createdBy').preload('updatedBy').preload('rooms')

      if (search) {
        query = query.where((builder) => {
          builder
            .where('name', 'LIKE', `%${search}%`)
            .orWhere('business_name', 'LIKE', `%${search}%`)
            .orWhere('email', 'LIKE', `%${search}%`)
            .orWhere('phone', 'LIKE', `%${search}%`)
            .orWhere('mobile', 'LIKE', `%${search}%`)
        })
      }

      const roomOwners = await query.paginate(page, limit)

      return response.ok({
        message: 'Room owners retrieved successfully',
        data: roomOwners,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve room owners',
        error: error.message,
      })
    }
  }

  /**
   * Create a new room owner
   */
  async store({ request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    try {
      const payload = await request.validateUsing(createRoomOwnerValidator)
      const user = auth.user!

      const roomOwnerData = {
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      }

      // Remove roomIds from the main data
      const { roomIds, ...roomOwnerFields } = roomOwnerData

      const roomOwner = await RoomOwner.create(roomOwnerFields, { client: trx })

      // Assign rooms if provided
      if (roomIds && roomIds.length > 0) {
        const rooms = await Room.query({ client: trx }).whereIn('id', roomIds)
        if (rooms.length !== roomIds.length) {
          await trx.rollback()
          return response.badRequest({
            message: 'One or more room IDs are invalid',
          })
        }
        await roomOwner.related('rooms').attach(roomIds, trx)
      }

      // Create user account if requested
      if (payload.createUser && payload.email) {
        const userData = {
          email: payload.email,
          password: 'TempPassword123!', // Should be changed on first login
          firstName: payload.name.split(' ')[0] || payload.name,
          lastName: payload.name.split(' ').slice(1).join(' ') || '',
          role: 'room_owner',
          isActive: true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        }
        await User.create(userData, { client: trx })
      }

      await trx.commit()

      await roomOwner.load('rooms')
      await roomOwner.load('createdBy')

      return response.created({
        message: 'Room owner created successfully',
        data: roomOwner,
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to create room owner',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific room owner
   */
  async show({ params, response }: HttpContext) {
    try {
      const roomOwner = await RoomOwner.query()
        .where('id', params.id)
        .preload('createdBy')
        .preload('updatedBy')
        .preload('rooms')
        .firstOrFail()

      return response.ok({
        message: 'Room owner retrieved successfully',
        data: roomOwner,
      })
    } catch (error) {
      return response.notFound({
        message: 'Room owner not found',
        error: error.message,
      })
    }
  }

  /**
   * Update a room owner
   */
  async update({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    try {
      const payload = await request.validateUsing(updateRoomOwnerValidator)
      const user = auth.user!

      const roomOwner = await RoomOwner.findOrFail(params.id, { client: trx })

      const { roomIds, ...updateData } = payload

      roomOwner.merge({
        ...updateData,
        updatedByUserId: user.id,
      })

      await roomOwner.save()

      // Update room assignments if provided
      if (roomIds !== undefined) {
        if (roomIds.length > 0) {
          const rooms = await Room.query({ client: trx }).whereIn('id', roomIds)
          if (rooms.length !== roomIds.length) {
            await trx.rollback()
            return response.badRequest({
              message: 'One or more room IDs are invalid',
            })
          }
          await roomOwner.related('rooms').sync(roomIds, true, trx)
        } else {
          await roomOwner.related('rooms').detach([], trx)
        }
      }

      await trx.commit()

      await roomOwner.load('rooms')
      await roomOwner.load('updatedBy')

      return response.ok({
        message: 'Room owner updated successfully',
        data: roomOwner,
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to update room owner',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a room owner
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const roomOwner = await RoomOwner.findOrFail(params.id)

      await roomOwner.softDelete(user.id)

      return response.ok({
        message: 'Room owner deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete room owner',
        error: error.message,
      })
    }
  }

  /**
   * Restore a soft deleted room owner
   */
  async restore({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const roomOwner = await RoomOwner.withDeleted()
        .where('id', params.id)
        .where('is_deleted', true)
        .firstOrFail()

      await roomOwner.restore(user.id)

      return response.ok({
        message: 'Room owner restored successfully',
        data: roomOwner,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to restore room owner',
        error: error.message,
      })
    }
  }

  /**
   * Assign rooms to a room owner
   */
  async assignRooms({ params, request, response }: HttpContext) {
    const trx = await db.transaction()
    try {
      const payload = await request.validateUsing(assignRoomsValidator)

      const roomOwner = await RoomOwner.findOrFail(params.id, { client: trx })

      const rooms = await Room.query({ client: trx }).whereIn('id', payload.roomIds)
      if (rooms.length !== payload.roomIds.length) {
        await trx.rollback()
        return response.badRequest({
          message: 'One or more room IDs are invalid',
        })
      }

      await roomOwner.related('rooms').attach(payload.roomIds, trx)

      await trx.commit()

      await roomOwner.load('rooms')

      return response.ok({
        message: 'Rooms assigned successfully',
        data: roomOwner,
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to assign rooms',
        error: error.message,
      })
    }
  }

  /**
   * Remove room assignments from a room owner
   */
  async unassignRooms({ params, request, response }: HttpContext) {
    const trx = await db.transaction()
    try {
      const payload = await request.validateUsing(assignRoomsValidator)

      const roomOwner = await RoomOwner.findOrFail(params.id, { client: trx })

      await roomOwner.related('rooms').detach(payload.roomIds, trx)

      await trx.commit()

      await roomOwner.load('rooms')

      return response.ok({
        message: 'Rooms unassigned successfully',
        data: roomOwner,
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to unassign rooms',
        error: error.message,
      })
    }
  }

  /**
   * Get available rooms for assignment
   */
  async getAvailableRooms({ response }: HttpContext) {
    try {
      const rooms = await Room.query()
        .select('id', 'room_number', 'room_type_id')
        .preload('roomType', (query) => {
          query.select('id', 'name')
        })

      return response.ok({
        message: 'Available rooms retrieved successfully',
        data: rooms,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve available rooms',
        error: error.message,
      })
    }
  }

  /**
   * Get room owner statistics
   */
  async stats({ response }: HttpContext) {
    try {
      const totalRoomOwners = await RoomOwner.query().count('* as total')
      const activeRoomOwners = await RoomOwner.query().where('is_deleted', false).count('* as total')
      const deletedRoomOwners = await RoomOwner.onlyDeleted().count('* as total')
      const roomOwnersWithUsers = await RoomOwner.query().where('create_user', true).count('* as total')

      return response.ok({
        message: 'Room owner statistics retrieved successfully',
        data: {
          total: totalRoomOwners[0].$extras.total,
          active: activeRoomOwners[0].$extras.total,
          deleted: deletedRoomOwners[0].$extras.total,
          withUsers: roomOwnersWithUsers[0].$extras.total,
        },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve statistics',
        error: error.message,
      })
    }
  }
}