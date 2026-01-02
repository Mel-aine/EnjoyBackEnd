import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ReservationRoom from '#models/reservation_room'
import { createReservationRoomValidator, updateReservationRoomValidator } from '#validators/reservation_room'

export default class ReservationRoomsController {
  /**
   * Display a list of reservation rooms
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const reservationId = request.input('reservation_id')
      const roomId = request.input('room_id')
      const roomTypeId = request.input('room_type_id')
      const status = request.input('status')
      const checkInStatus = request.input('check_in_status')
      const dateFrom = request.input('date_from')
      const dateTo = request.input('date_to')

      const query = ReservationRoom.query()
        .whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))

      if (reservationId) {
        query.where('reservation_id', reservationId)
      }

      if (roomId) {
        query.where('room_id', roomId)
      }

      if (roomTypeId) {
        query.where('room_type_id', roomTypeId)
      }

      if (search) {
        query.whereHas('room', (roomQuery) => {
          roomQuery.where('room_number', 'ILIKE', `%${search}%`)
        })
      }

      if (status) {
        query.where('status', status)
      }

      if (checkInStatus) {
        query.where('check_in_status', checkInStatus)
      }

      if (status) {
        query.where('check_out_status', status)
      }

      if (dateFrom) {
        query.where('check_in_date', '>=', new Date(dateFrom))
      }

      if (dateTo) {
        query.where('check_out_date', '<=', new Date(dateTo))
      }

      const reservationRooms = await query
        .preload('room')
        .preload('roomType')
        .preload('paymentMethod')
        .orderBy('check_in_date', 'desc')
        .paginate(page, limit)

      return response.ok({
        message: 'Reservation rooms retrieved successfully',
        data: reservationRooms
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve reservation rooms',
        error: error.message
      })
    }
  }

  /**
   * Create a new reservation room
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationRoomValidator)

      // Create new reservation room instance to avoid type conflicts
      const reservationRoom = new ReservationRoom()
      Object.assign(reservationRoom, payload)
      reservationRoom.createdBy = auth.user?.id || 0
      await reservationRoom.save()

      await reservationRoom.load('room')
      await reservationRoom.load('roomType')

      return response.created({
        message: 'Reservation room created successfully',
        data: reservationRoom
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create reservation room',
        error: error.message
      })
    }
  }

  /**
   * Show a specific reservation room
   */
  async show({ params, response }: HttpContext) {
    try {
      const reservationRoom = await ReservationRoom.query()
        .where('id', params.id)
        .preload('room')
        .preload('roomType')
        .preload('paymentMethod')
        .firstOrFail()

      return response.ok({
        message: 'Reservation room retrieved successfully',
        data: reservationRoom
      })
    } catch (error) {
      return response.notFound({
        message: 'Reservation room not found',
        error: error.message
      })
    }
  }

  /**
   * Update a reservation room
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const reservationRoom = await ReservationRoom.findOrFail(params.id)
      const payload = await request.validateUsing(updateReservationRoomValidator)

      // Update individual properties to avoid type conflicts
      Object.assign(reservationRoom, payload)
      reservationRoom.lastModifiedBy = auth.user?.id || 0

      await reservationRoom.save()
      await reservationRoom.load('room')
      await reservationRoom.load('roomType')

      return response.ok({
        message: 'Reservation room updated successfully',
        data: reservationRoom
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update reservation room',
        error: error.message
      })
    }
  }

  /**
   * Delete a reservation room
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const reservationRoom = await ReservationRoom.findOrFail(params.id)

      // Check if guest is already checked in
      if (reservationRoom.status === 'checked_in') {
        return response.badRequest({
          message: 'Cannot delete reservation room for checked-in guest'
        })
      }

      await reservationRoom.delete()

      return response.ok({
        message: 'Reservation room deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete reservation room',
        error: error.message
      })
    }
  }

  /**
   * Check in guest
   */
  async checkIn({ params, request, response, auth }: HttpContext) {
    try {
      const reservationRoom = await ReservationRoom.findOrFail(params.id)
      const { actualCheckInTime, notes, keyCardsIssued, depositAmount } = request.only([
        'actualCheckInTime', 'notes', 'keyCardsIssued', 'depositAmount'
      ])

      if (reservationRoom.status === 'checked_in') {
        return response.badRequest({
          message: 'Guest is already checked in'
        })
      }

      reservationRoom.status = 'checked_in'
      reservationRoom.actualCheckInTime = actualCheckInTime
      reservationRoom.guestNotes = notes
      reservationRoom.keyCardsIssued = keyCardsIssued || 2
      reservationRoom.amenitiesProvided = depositAmount || 0
      reservationRoom.checkedInBy = auth.user?.id!
      //reservationRoom.checkedOutBy = auth.user?.id

      await reservationRoom.save()

      return response.ok({
        message: 'Guest checked in successfully',
        data: reservationRoom
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to check in guest',
        error: error.message
      })
    }
  }

  /**
   * Check out guest
   */
  async checkOut({ params, request, response, auth }: HttpContext) {
    try {
      const reservationRoom = await ReservationRoom.findOrFail(params.id)
      const { actualCheckOutTime, notes } = request.only([
        'actualCheckOutTime', 'notes'
      ])

      if (reservationRoom.status === 'checked_out') {
        return response.badRequest({
          message: 'Guest is already checked out'
        })
      }

      if (reservationRoom.status !== 'checked_in') {
        return response.badRequest({
          message: 'Guest must be checked in before checking out'
        })
      }

      reservationRoom.status = 'checked_out'
      reservationRoom.actualCheckOutTime = actualCheckOutTime ? DateTime.fromJSDate(new Date(actualCheckOutTime)) : DateTime.now()
      reservationRoom.guestNotes = notes
      reservationRoom.checkedOutBy = auth.user?.id || 0
      reservationRoom.lastModifiedBy = auth.user?.id || 0

      await reservationRoom.save()

      return response.ok({
        message: 'Guest checked out successfully',
        data: reservationRoom
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to check out guest',
        error: error.message
      })
    }
  }

  /**
   * Update room assignment
   */
  async updateRoomAssignment({ params, request, response, auth }: HttpContext) {
    try {
      const reservationRoom = await ReservationRoom.findOrFail(params.id)
      const { newRoomId, reason } = request.only(['newRoomId', 'reason'])

      if (!newRoomId) {
        return response.badRequest({
          message: 'New room ID is required'
        })
      }

      const oldRoomId = reservationRoom.roomId
      reservationRoom.roomId = newRoomId
      reservationRoom.internalNotes = reason
      reservationRoom.lastModifiedBy = auth.user?.id || 0

      await reservationRoom.save()
      await reservationRoom.load('room')

      return response.ok({
        message: 'Room assignment updated successfully',
        data: {
          reservationRoom,
          oldRoomId,
          newRoomId,
          reason
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update room assignment',
        error: error.message
      })
    }
  }

  /**
   * Update guest preferences
   */
  async updatePreferences({ params, request, response, auth }: HttpContext) {
    try {
      const reservationRoom = await ReservationRoom.findOrFail(params.id)
      const { preferences } = request.only(['preferences'])

      if (!preferences) {
        return response.badRequest({
          message: 'Preferences are required'
        })
      }

      reservationRoom.guestPreferences = preferences
      reservationRoom.lastModifiedBy = auth.user?.id || 0

      await reservationRoom.save()

      return response.ok({
        message: 'Guest preferences updated successfully',
        data: reservationRoom
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update preferences',
        error: error.message
      })
    }
  }

  /**
   * Add special requests
   */
  async addSpecialRequests({ params, request, response, auth }: HttpContext) {
    try {
      const reservationRoom = await ReservationRoom.findOrFail(params.id)
      const { specialRequests } = request.only(['specialRequests'])

      if (!specialRequests) {
        return response.badRequest({
          message: 'Special requests are required'
        })
      }

      reservationRoom.specialRequests = specialRequests
      reservationRoom.lastModifiedBy = auth.user?.id || 0

      await reservationRoom.save()

      return response.ok({
        message: 'Special requests added successfully',
        data: reservationRoom
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to add special requests',
        error: error.message
      })
    }
  }

  /**
   * Get current occupancy
   */
  async currentOccupancy({ request, response }: HttpContext) {
    try {
      const { hotelId, roomId, roomTypeId } = request.only(['hotelId', 'roomId', 'roomTypeId'])

      const query = ReservationRoom.query()
        .where('check_in_status', 'checked_in')
        .where('check_out_status', '!=', 'checked_out')
        .where('status', 'confirmed')
        .whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))

      if (hotelId) {
        query.whereHas('room', (roomQuery) => {
          roomQuery.where('hotel_id', hotelId)
        })
      }

      if (roomId) {
        query.where('room_id', roomId)
      }

      if (roomTypeId) {
        query.where('room_type_id', roomTypeId)
      }

      const occupiedRooms = await query
        .preload('room')
        .preload('roomType')
        .orderBy('check_in_date', 'desc')

      return response.ok({
        message: 'Current occupancy retrieved successfully',
        data: occupiedRooms
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve current occupancy',
        error: error.message
      })
    }
  }

  /**
   * Get arrivals for a specific date
   */
  async arrivals({ request, response }: HttpContext) {
    try {
      const { date, hotelId } = request.only(['date', 'hotelId'])

      if (!date) {
        return response.badRequest({
          message: 'Date is required'
        })
      }

      const arrivalDate = new Date(date)
      const nextDay = new Date(arrivalDate)
      nextDay.setDate(nextDay.getDate() + 1)

      const query = ReservationRoom.query()
        .where('check_in_date', '>=', arrivalDate)
        .where('check_in_date', '<', nextDay)
        .where('status', 'confirmed')

      if (hotelId) {
      query.whereHas('room', (roomQuery) => {
        roomQuery.where('hotel_id', hotelId)
      })
    }

    // Exclude Paymaster rooms
    query.whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))

    const departingRooms = await query
      .preload('room')
        .preload('roomType')
        .orderBy('expected_check_in_time', 'asc')

      return response.ok({
        message: 'Arrivals retrieved successfully',
        data: arrivals
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve arrivals',
        error: error.message
      })
    }
  }

  /**
   * Get departures for a specific date
   */
  async departures({ request, response }: HttpContext) {
    try {
      const { date, hotelId } = request.only(['date', 'hotelId'])

      if (!date) {
        return response.badRequest({
          message: 'Date is required'
        })
      }

      const departureDate = new Date(date)
      const nextDay = new Date(departureDate)
      nextDay.setDate(nextDay.getDate() + 1)

      const query = ReservationRoom.query()
        .where('check_out_date', '>=', departureDate)
        .where('check_out_date', '<', nextDay)
        .where('status', 'confirmed')

      if (hotelId) {
      query.whereHas('room', (roomQuery) => {
        roomQuery.where('hotel_id', hotelId)
      })
    }

    // Exclude Paymaster rooms
    query.whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))

    const occupiedRooms = await query
      .preload('room')
        .preload('roomType')
        .orderBy('expected_check_out_time', 'asc')

      return response.ok({
        message: 'Departures retrieved successfully',
        data: departures
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve departures',
        error: error.message
      })
    }
  }

  /**
   * Get reservation room statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const { hotelId, period } = request.only(['hotelId', 'period'])

      const query = ReservationRoom.query()
        .whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))
      if (hotelId) {
        query.whereHas('room', (roomQuery) => {
          roomQuery.where('hotel_id', hotelId)
        })
      }

      // Apply period filter if provided
      if (period) {
        const now = new Date()
        let startDate: Date

        switch (period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            break
          default:
            startDate = new Date(0)
        }

        query.where('check_in_date', '>=', startDate)
      }

      const totalReservations = await query.clone().count('* as total')
      const checkedInReservations = await query.clone().where('check_in_status', 'checked_in').count('* as total')
      const checkedOutReservations = await query.clone().where('check_out_status', 'checked_out').count('* as total')
      const noShowReservations = await query.clone().where('check_in_status', 'no_show').count('* as total')
      const cancelledReservations = await query.clone().where('status', 'cancelled').count('* as total')

      const averageStayLength = await query.clone()
        .whereNotNull('actual_check_out_time')
        .whereNotNull('actual_check_in_time')
        .avg('nights as avg_nights')

      const stats = {
        totalReservations: totalReservations[0].$extras.total,
        checkedInReservations: checkedInReservations[0].$extras.total,
        checkedOutReservations: checkedOutReservations[0].$extras.total,
        noShowReservations: noShowReservations[0].$extras.total,
        cancelledReservations: cancelledReservations[0].$extras.total,
        averageStayLength: averageStayLength[0].$extras.avg_nights || 0,
        occupancyRate: totalReservations[0].$extras.total > 0 ?
          (checkedInReservations[0].$extras.total / totalReservations[0].$extras.total * 100).toFixed(2) : 0
      }

      return response.ok({
        message: 'Reservation room statistics retrieved successfully',
        data: stats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message
      })
    }
  }


}
