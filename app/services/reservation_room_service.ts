import ReservationRoom from '#models/reservation_room'
import Room from '#models/room'
import { DateTime } from 'luxon'

export default class ReservationRoomService {
  /**
   * Check room availability for given dates
   */
  async checkRoomAvailability(
    roomId: number,
    checkInDate: Date,
    checkOutDate: Date,
    excludeReservationId?: number
  ): Promise<boolean> {
    const query = ReservationRoom.query()
      .where('room_id', roomId)
      .where('status', '!=', 'cancelled')
      .where(function (subQuery) {
        subQuery
          .whereBetween('check_in_date', [checkInDate, checkOutDate])
          .orWhereBetween('check_out_date', [checkInDate, checkOutDate])
          .orWhere(function (dateQuery) {
            dateQuery
              .where('check_in_date', '<=', checkInDate)
              .where('check_out_date', '>=', checkOutDate)
          })
      })

    if (excludeReservationId) {
      query.where('reservation_id', '!=', excludeReservationId)
    }

    const conflictingReservations = await query
    return conflictingReservations.length === 0
  }

  /**
   * Find available rooms for given criteria
   */
  async findAvailableRooms(
    hotelId: number,
    checkInDate: Date,
    checkOutDate: Date,
    roomTypeId?: number,
    adults?: number,
    children?: number
  ): Promise<Room[]> {
    const roomQuery = Room.query()
      .where('hotel_id', hotelId)
      .where('status', 'available')
      .where('housekeeping_status', 'clean')


    if (roomTypeId) {
      roomQuery.where('room_type_id', roomTypeId)
    }

    if (adults) {
      roomQuery.whereHas('roomType', (roomTypeQuery) => {
        roomTypeQuery.where('max_adult', '>=', adults)
      })
    }

    if (children) {
      roomQuery.whereHas('roomType', (roomTypeQuery) => {
        roomTypeQuery.where('max_child', '>=', children)
      })
    }

    const allRooms = await roomQuery.preload('roomType')

    // Filter out rooms that are already booked for the given dates
    const availableRooms: Room[] = []
    for (const room of allRooms) {
      const isAvailable = await this.checkRoomAvailability(
        room.id,
        checkInDate,
        checkOutDate
      )
      if (isAvailable) {
        availableRooms.push(room)
      }
    }

    return availableRooms
  }

  /**
   * Calculate total charges for a reservation room
   */
  async calculateTotalCharges(reservationRoomId: number): Promise<number> {
    const reservationRoom = await ReservationRoom.findOrFail(reservationRoomId)

    const totalCharges = (
      (reservationRoom.roomCharges || 0) +
      (reservationRoom.incidentalCharges || 0) +
      (reservationRoom.damageCharges || 0) +
      (reservationRoom.minibarCharges || 0) +
      (reservationRoom.phoneCharges || 0) +
      (reservationRoom.internetCharges || 0) +
      (reservationRoom.laundryCharges || 0) +
      (reservationRoom.spaCharges || 0) +
      (reservationRoom.restaurantCharges || 0) +
      (reservationRoom.roomServiceCharges || 0) +
      (reservationRoom.parkingCharges || 0) +
      (reservationRoom.businessCenterCharges || 0) +
      (reservationRoom.otherCharges || 0)
    )

    // Update the total charges in the database
    reservationRoom.totalCharges = totalCharges
    await reservationRoom.save()

    return totalCharges
  }

  /**
   * Process check-in for a reservation room
   */
  async processCheckIn(
    reservationRoomId: number,
    checkInData: {
      actualCheckInTime?: Date
      keyCardsIssued?: number
      depositAmount?: number
      notes?: string
      checkedInBy: number
    }
  ): Promise<ReservationRoom> {
    const reservationRoom = await ReservationRoom.findOrFail(reservationRoomId)

    if (reservationRoom.status === 'checked_in') {
      throw new Error('Guest is already checked in')
    }

    if (reservationRoom.status === 'cancelled') {
      throw new Error('Cannot check in cancelled reservation')
    }

    // Update check-in details
    reservationRoom.status = 'checked_in'
    reservationRoom.actualCheckInTime = checkInData.actualCheckInTime ? DateTime.fromJSDate(checkInData.actualCheckInTime) : DateTime.now()
    reservationRoom.keyCardsIssued = checkInData.keyCardsIssued || 2
    reservationRoom.depositAmount = checkInData.depositAmount || 0
    reservationRoom.checkInNotes = checkInData.notes || ''
    reservationRoom.checkedInBy = checkInData.checkedInBy
    reservationRoom.lastModifiedBy = checkInData.checkedInBy

    // Update room status to occupied
    const room = await Room.findOrFail(reservationRoom.roomId)
    room.status = 'occupied'
    room.housekeepingStatus = 'dirty'
    await room.save()

    await reservationRoom.save()
    return reservationRoom
  }

  /**
   * Process check-out for a reservation room
   */
  async processCheckOut(
    reservationRoomId: number,
    checkOutData: {
      actualCheckOutTime?: Date
      keyCardsReturned?: number
      damageCharges?: number
      minibarCharges?: number
      notes?: string
      checkedOutBy: number
    }
  ): Promise<ReservationRoom> {
    const reservationRoom = await ReservationRoom.findOrFail(reservationRoomId)

    if (reservationRoom.status === 'checked_out') {
      throw new Error('Guest is already checked out')
    }

    if (reservationRoom.status !== 'checked_in') {
      throw new Error('Guest must be checked in before checking out')
    }

    // Update check-out details
    reservationRoom.status = 'checked_out'
    reservationRoom.actualCheckOutTime = checkOutData.actualCheckOutTime ? DateTime.fromJSDate(checkOutData.actualCheckOutTime) : DateTime.now()
    reservationRoom.keyCardsReturned = checkOutData.keyCardsReturned || reservationRoom.keyCardsIssued
    reservationRoom.damageCharges = checkOutData.damageCharges || 0
    reservationRoom.minibarCharges = checkOutData.minibarCharges || 0
    reservationRoom.checkOutNotes = checkOutData.notes || ''
    reservationRoom.checkedOutBy = checkOutData.checkedOutBy
    reservationRoom.lastModifiedBy = checkOutData.checkedOutBy

    // Update room status to available and housekeeping to dirty
    const room = await Room.findOrFail(reservationRoom.roomId)
    room.status = 'available'
    room.housekeepingStatus = 'dirty'
    await room.save()

    // Calculate total charges
    await this.calculateTotalCharges(reservationRoomId)

    await reservationRoom.save()
    return reservationRoom
  }

  /**
   * Process room change for a reservation
   */
  async processRoomChange(
    reservationRoomId: number,
    newRoomId: number,
    reason: string,
    changedBy: number
  ): Promise<ReservationRoom> {
    const reservationRoom = await ReservationRoom.findOrFail(reservationRoomId)
    const oldRoomId = reservationRoom.roomId

    // Check if new room is available
    const isAvailable = await this.checkRoomAvailability(
      newRoomId,
      reservationRoom.checkInDate.toJSDate(),
      reservationRoom.checkOutDate.toJSDate(),
      reservationRoom.reservationId
    )

    if (!isAvailable) {
      throw new Error('New room is not available for the selected dates')
    }

    // Update old room status if guest was checked in
    if (reservationRoom.status === 'checked_in') {
      const oldRoom = await Room.findOrFail(oldRoomId)
      oldRoom.status = 'available'
      oldRoom.housekeepingStatus = 'dirty'
      await oldRoom.save()

      // Update new room status
      const newRoom = await Room.findOrFail(newRoomId)
      newRoom.status = 'occupied'
      newRoom.housekeepingStatus = 'dirty'
      await newRoom.save()
    }

    // Update reservation room
    reservationRoom.roomId = newRoomId
    reservationRoom.roomChangeReason = reason
    reservationRoom.roomChangedAt = DateTime.now()
    reservationRoom.roomChangedBy = changedBy
    reservationRoom.lastModifiedBy = changedBy

    await reservationRoom.save()
    return reservationRoom
  }

  /**
   * Process room upgrade
   */
  async processRoomUpgrade(
    reservationRoomId: number,
    newRoomTypeId: number,
    newRoomId: number,
    reason: string,
    upgradedBy: number
  ): Promise<ReservationRoom> {
    const reservationRoom = await ReservationRoom.findOrFail(reservationRoomId)

    // Verify that the new room type is actually an upgrade
    //const currentRoomType = await RoomType.findOrFail(reservationRoom.roomTypeId)
    //const newRoomType = await RoomType.findOrFail(newRoomTypeId)

    /*if (newRoomType.baseRate <= currentRoomType.baseRate) {
      throw new Error('New room type is not an upgrade')
    }*/

    // Process room change
    await this.processRoomChange(reservationRoomId, newRoomId, reason, upgradedBy)

    // Update upgrade details
    reservationRoom.roomTypeId = newRoomTypeId
    reservationRoom.upgradeReason = reason
    reservationRoom.upgradedAt = DateTime.now()
    reservationRoom.upgradedBy = upgradedBy
    reservationRoom.lastModifiedBy = upgradedBy

    await reservationRoom.save()
    return reservationRoom
  }

  /**
   * Process no-show
   */
  async processNoShow(
    reservationRoomId: number,
    reason: string,
    processedBy: number
  ): Promise<ReservationRoom> {
    const reservationRoom = await ReservationRoom.findOrFail(reservationRoomId)

    if (reservationRoom.status === 'checked_in') {
      throw new Error('Cannot mark as no-show: guest is already checked in')
    }

    reservationRoom.status = 'no_show'
    reservationRoom.noShowReason = reason
    reservationRoom.noShowAt = DateTime.now()
    reservationRoom.noShowBy = processedBy
    reservationRoom.lastModifiedBy = processedBy

    // Make room available again
    const room = await Room.findOrFail(reservationRoom.roomId)
    room.status = 'available'
    await room.save()

    await reservationRoom.save()
    return reservationRoom
  }

  /**
   * Process cancellation
   */
  async processCancellation(
    reservationRoomId: number,
    reason: string,
    cancelledBy: number
  ): Promise<ReservationRoom> {
    const reservationRoom = await ReservationRoom.findOrFail(reservationRoomId)

    if (reservationRoom.status === 'checked_in') {
      throw new Error('Cannot cancel: guest is already checked in')
    }

    reservationRoom.status = 'cancelled'
    reservationRoom.cancellationReason = reason
    reservationRoom.cancelledAt = DateTime.now()
    reservationRoom.cancelledBy = cancelledBy
    reservationRoom.lastModifiedBy = cancelledBy

    // Make room available again
    const room = await Room.findOrFail(reservationRoom.roomId)
    room.status = 'available'
    await room.save()

    await reservationRoom.save()
    return reservationRoom
  }

  /**
   * Get occupancy statistics for a hotel
   */
  async getOccupancyStats(
    hotelId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRooms: number
    occupiedRooms: number
    availableRooms: number
    occupancyRate: number
    averageDailyRate: number
    revenue: number
  }> {
    // Get total rooms for the hotel
    const totalRooms = await Room.query()
      .where('hotel_id', hotelId)
      .where('status', '!=', 'out_of_order')
      .count('* as total')

    // Get occupied rooms for the period
    const occupiedRooms = await ReservationRoom.query()
      .whereHas('room', (roomQuery) => {
        roomQuery.where('hotel_id', hotelId)
      })
      .where('check_in_status', 'checked_in')
      .where('check_out_status', '!=', 'checked_out')
      .whereBetween('check_in_date', [startDate, endDate])
      .count('* as total')

    // Calculate revenue and ADR
    const revenueData = await ReservationRoom.query()
      .whereHas('room', (roomQuery) => {
        roomQuery.where('hotel_id', hotelId)
      })
      .whereBetween('check_in_date', [startDate, endDate])
      .where('status', '!=', 'cancelled')
      .sum('total_amount as revenue')
      .count('* as reservations')

    const totalRoomsCount = totalRooms[0].$extras.total
    const occupiedRoomsCount = occupiedRooms[0].$extras.total
    const availableRoomsCount = totalRoomsCount - occupiedRoomsCount
    const occupancyRate = totalRoomsCount > 0 ? (occupiedRoomsCount / totalRoomsCount) * 100 : 0
    const revenue = revenueData[0].$extras.revenue || 0
    const reservationsCount = revenueData[0].$extras.reservations || 0
    const averageDailyRate = reservationsCount > 0 ? revenue / reservationsCount : 0

    return {
      totalRooms: totalRoomsCount,
      occupiedRooms: occupiedRoomsCount,
      availableRooms: availableRoomsCount,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      averageDailyRate: Math.round(averageDailyRate * 100) / 100,
      revenue: Math.round(revenue * 100) / 100
    }
  }

  /**
   * Get arrivals and departures for a specific date
   */
  async getArrivalsAndDepartures(
    hotelId: number,
    date: Date
  ): Promise<{
    arrivals: ReservationRoom[]
    departures: ReservationRoom[]
  }> {
    const startOfDay = DateTime.fromJSDate(date).startOf('day').toJSDate()
    const endOfDay = DateTime.fromJSDate(date).endOf('day').toJSDate()

    const arrivals = await ReservationRoom.query()
      .whereHas('room', (roomQuery) => {
        roomQuery.where('hotel_id', hotelId)
      })
      .whereBetween('check_in_date', [startOfDay, endOfDay])
      .where('status', 'confirmed')
      .preload('room')
      .preload('roomType')
      .orderBy('expected_check_in_time', 'asc')

    const departures = await ReservationRoom.query()
      .whereHas('room', (roomQuery) => {
        roomQuery.where('hotel_id', hotelId)
      })
      .whereBetween('check_out_date', [startOfDay, endOfDay])
      .where('status', 'confirmed')
      .preload('room')
      .preload('roomType')
      .orderBy('expected_check_out_time', 'asc')

    return {
      arrivals,
      departures
    }
  }

  /**
   * Get housekeeping tasks for a specific date
   */
  async getHousekeepingTasks(
    hotelId: number,
    date: Date
  ): Promise<{
    checkouts: ReservationRoom[]
    stayovers: ReservationRoom[]
    checkins: ReservationRoom[]
  }> {
    const startOfDay = DateTime.fromJSDate(date).startOf('day').toJSDate()
    const endOfDay = DateTime.fromJSDate(date).endOf('day').toJSDate()

    // Rooms that need cleaning after checkout
    const checkouts = await ReservationRoom.query()
      .whereHas('room', (roomQuery) => {
        roomQuery.where('hotel_id', hotelId)
      })
      .whereBetween('check_out_date', [startOfDay, endOfDay])
      .where('check_out_status', 'checked_out')
      .preload('room')
      .preload('roomType')

    // Rooms with guests staying over (need maintenance cleaning)
    const stayovers = await ReservationRoom.query()
      .whereHas('room', (roomQuery) => {
        roomQuery.where('hotel_id', hotelId)
      })
      .where('check_in_status', 'checked_in')
      .where('check_out_status', '!=', 'checked_out')
      .where('check_in_date', '<', startOfDay)
      .where('check_out_date', '>', endOfDay)
      .preload('room')
      .preload('roomType')

    // Rooms that need to be prepared for incoming guests
    const checkins = await ReservationRoom.query()
      .whereHas('room', (roomQuery) => {
        roomQuery.where('hotel_id', hotelId)
      })
      .whereBetween('check_in_date', [startOfDay, endOfDay])
      .where('status', 'confirmed')
      .where('check_in_status', 'pending')
      .preload('room')
      .preload('roomType')

    return {
      checkouts,
      stayovers,
      checkins
    }
  }
}
