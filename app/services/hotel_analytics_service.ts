import Reservation from '#models/reservation'
import { DateTime } from 'luxon'
import Room from '#models/room'
import RoomBlock from '#models/room_block'
import logger from '@adonisjs/core/services/logger'
import ReservationsController from '../controllers/reservations_controller.js'

export class HotelAnalyticsService {
  /**
   * Determine if a guest is a woman based on their title
   */
  private static isWomanTitle(title: string): boolean {
    if (!title) return false

    const womenTitles = [
      'ms',
      'mrs',
      'miss',
      'madam',
      'madame',
      'lady',
      'dame',
      'ms.',
      'mrs.',
      'miss.',
      'madam.',
      'madame.',
      'lady.',
      'dame.',
      'girl',
      'girls',
      'woman',
      'women',
      'female',
    ]

    return womenTitles.includes(title.toLowerCase().trim())
  }

  public static async getDailyOccupancyAndReservations(
    hotelId: number,
    startDate: DateTime,
    endDate: DateTime
  ) {
    const roomsPromise = Room.query()
      .select(['id','room_type_id','status','housekeeping_status','room_number','sort_key','smoking_allowed'])
      .where('hotel_id', hotelId)
      .preload('roomType', (rtQuery) => {
        rtQuery.select(['id', 'room_type_name', 'sort_order', 'max_adult','is_paymaster'])
      })
      .orderBy('sort_key', 'asc')
    const blocksPromise = RoomBlock.query()
      .select([
        'id',
        'room_id',
        'room_type_id',
        'status',
        'hotel_id',
        'block_from_date',
        'block_to_date',
        'reason',
        'created_at',
        'updated_at',
      ])
      .where('hotel_id', hotelId)
      .whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))
      .where((query) => {
        query
          .whereBetween('block_from_date', [
            startDate.toFormat('yyyy-MM-dd'),
            endDate.toFormat('yyyy-MM-dd'),
          ])
          .orWhereBetween('block_to_date', [
            startDate.toFormat('yyyy-MM-dd'),
            endDate.toFormat('yyyy-MM-dd'),
          ])
          .orWhere((subQuery) => {
            subQuery
              .where('block_from_date', '<=', startDate.toFormat('yyyy-MM-dd'))
              .andWhere('block_to_date', '>=', endDate.toFormat('yyyy-MM-dd'))
          })
      })
      .preload('room', (roomQuery) => {
        roomQuery.select(['id', 'room_number', 'floor_number'])
      })
      .preload('roomType', (rtQuery) => {
        rtQuery.select(['id', 'room_type_name'])
      })
      .orderBy('block_from_date', 'desc')
    const reservationsPromise = Reservation.query()
      .select([
        'id',
        'arrived_date',
        'depart_date',
        'status',
        'guest_count',
        'reservation_number',
        'total_amount',
        'remaining_amount',
        'customer_type',
        'company_name',
        'group_name',
        'number_of_nights',
        'payment_status',
        "guestId",
        "bookingSourceId",
        "businessSourceId",
        "otaName"
      ])
      .where('hotel_id', hotelId)
      .andWhereNotIn('status', ['cancelled', 'no-show', 'no_show', 'voided'])
      .andWhere((query) => {
        // Find overlapping reservations:
        // (StartA <= EndB) and (EndA >= StartB)
        query.where('arrived_date', '<=', endDate.toISODate()!)
             .andWhere('depart_date', '>=', startDate.toISODate()!)
      })
      .preload('reservationRooms', (rspQuery) => {
        rspQuery
          .select([
            'id',
            'room_id',
            'room_type_id',
            'status',
            'check_in_date',
            'check_out_date',
            'check_in_time',
            'check_out_time',
            'adults',
            'children',
            'guestId',
            'special_requests',
            'room_rate',
            'isSplitedOrigin',
            'isplited_destinatination',
          ])
          .preload('roomType', (rt) => rt.select(['id', 'is_paymaster']))
          .preload('room', (spQuery: any) => {
            spQuery
              .select(['id', 'room_number', 'room_type_id'])
              .preload('roomType', (rtQuery:any) => {
                rtQuery.select(['id', 'room_type_name'])
              })
          })
          .preload('guest', (guestQuery) => {
            guestQuery.select(['id', 'title', 'first_name', 'last_name'])
          })
      })
      .preload('guest', (gq) => {
        gq.select(['id', 'title', 'first_name', 'last_name'])
      })
      .preload('folios', (folioQuery) => {
        folioQuery.select(['id']).preload('transactions', (txQuery) => {
          txQuery.select([
            'amount',
            'transaction_type',
            'status',
            'is_voided',
            'service_charge_amount',
            'tax_amount',
          ])
          .whereNull('mealPlanId')
        })
      })
      .preload('bookingSource', (bsQuery) => {
        bsQuery.select(['id', 'source_name', 'source_code'])
      })
      .preload('businessSource', (busQuery) => {
        busQuery.select(['id', 'name'])
      })
    const [allRooms, roomBlocks, reservations] = await Promise.all([
      roomsPromise,
      blocksPromise,
      reservationsPromise,
    ])

    const totalRooms = allRooms.filter((rm)=>!rm.roomType?.isPaymaster).length

    if (totalRooms === 0) {
      return {
        daily_occupancy_metrics: [],
        grouped_reservation_details: [],
      }
    }

    // 2. Derive room types for the hotel and build fast indexes
    const roomTypes = Array.from(
      new Map(allRooms.filter((r) => r.roomType).map((r) => [r.roomType!.id, r.roomType!])).values()
    ).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    // Indexes for fast lookups
    const roomTypeByRoomId = new Map<number, number>()
    const roomsByTypeTotal = new Map<number, number>()
    const staticBlockedOrOO = new Set<number>()
    const staticDirtyOrCleaning = new Set<number>()

    for (const room of allRooms) {
      if (room.roomTypeId) {
        roomTypeByRoomId.set(room.id, room.roomTypeId)
        roomsByTypeTotal.set(room.roomTypeId, (roomsByTypeTotal.get(room.roomTypeId) || 0) + 1)
      }
      if (
        room.status === 'blocked' ||
        room.status === 'out_of_order' ||
        room.status === 'maintenance' ||
        room.housekeepingStatus === 'out_of_order'
      ) {
        staticBlockedOrOO.add(room.id)
      }
      if (room.housekeepingStatus === 'dirty' || room.housekeepingStatus === 'cleaning') {
        staticDirtyOrCleaning.add(room.id)
      }
    }

    const staticExcludedByTypeCount = new Map<number, number>()
    for (const roomId of staticBlockedOrOO) {
      const typeId = roomTypeByRoomId.get(roomId)
      if (typeId !== undefined) {
        staticExcludedByTypeCount.set(typeId, (staticExcludedByTypeCount.get(typeId) || 0) + 1)
      }
    }



    // 4. Calculate daily occupancy metrics
    const dailyMetrics = []
    for (let dt = startDate; dt <= endDate; dt = dt.plus({ days: 1 })) {
      const currentDate = dt

      const activeReservationsForDay = reservations.filter(
        (r) =>
          r.arrivedDate &&
          r.departDate &&
          r.arrivedDate <= currentDate &&
          r.departDate > currentDate
      )

      const occupiedRoomIds = new Set<number>()
      let unassignedReservationsCount = 0
      let occupiedEffCount = 0

      for (const reservation of activeReservationsForDay) {
        let isAssignedForToday = false
        if (reservation.reservationRooms.length > 0) {
          const currentDateStr = currentDate.toISODate()!
          const coversToday = (rr: any) => {
            const ci = rr.checkInDate ? rr.checkInDate.toISODate() : ''
            const co = rr.checkOutDate ? rr.checkOutDate.toISODate() : ''
            return !!ci && !!co && ci <= currentDateStr && co > currentDateStr
          }
          const normalCount = reservation.reservationRooms.filter(
            (rr: any) =>
              coversToday(rr) &&
              rr.roomId &&
              !rr.roomType?.isPaymaster
          ).length
          occupiedEffCount += normalCount
          for (const rsp of reservation.reservationRooms) {
            if (rsp.roomId && coversToday(rsp)) {
              occupiedRoomIds.add(rsp.roomId)
              isAssignedForToday = true
            }
          }

          if (!isAssignedForToday) {
            logger.info(reservation)
            unassignedReservationsCount++
          }
        }
      }



      // Get blocked room IDs for this specific date from preloaded blocks
      const blockedRoomIds = new Set<number>()
      const currentDateStr = currentDate.toFormat('yyyy-MM-dd')
      roomBlocks.forEach((block) => {
        const fromStr = (block.blockFromDate as any)?.toFormat
          ? (block.blockFromDate as any).toFormat('yyyy-MM-dd')
          : String(block.blockFromDate)
        const toStr = (block.blockToDate as any)?.toFormat
          ? (block.blockToDate as any).toFormat('yyyy-MM-dd')
          : String(block.blockToDate)
        if (fromStr && toStr && fromStr <= currentDateStr && toStr >= currentDateStr) {
          if (block.room) {
            blockedRoomIds.add(block.room.id)
          }
        }
      })

      const netTotalRooms = Math.max(0, totalRooms - blockedRoomIds.size)
      const occupancyRate = netTotalRooms > 0 ? (occupiedEffCount / netTotalRooms) * 100 : 0

      // Calculate available rooms per room type using precomputed totals
      const availableRoomsByType: {
        [key: number]: { room_type_id: number; room_type_name: string; available_count: number }
      } = {}

      roomTypes.forEach((roomType) => {
        const baseAvailable =
          (roomsByTypeTotal.get(roomType.id) || 0) -
          (staticExcludedByTypeCount.get(roomType.id) || 0)
        availableRoomsByType[roomType.id] = {
          room_type_id: roomType.id,
          room_type_name: roomType.roomTypeName,
          available_count: baseAvailable,
        }
      })

      // Get all room IDs that have reservations for this specific date (not just occupied)
      const reservedRoomIds = new Set<number>()
      activeReservationsForDay.forEach((reservation) => {
        reservation.reservationRooms.forEach((rr) => {
          if (rr.roomId) {
            reservedRoomIds.add(rr.roomId)
          }
        })
      })

      // Subtract reserved and blocked from base availability per type
      reservedRoomIds.forEach((roomId) => {
        const typeId = roomTypeByRoomId.get(roomId)
        if (typeId !== undefined && availableRoomsByType[typeId]) {
          availableRoomsByType[typeId].available_count = Math.max(
            0,
            availableRoomsByType[typeId].available_count - 1
          )
        }
      })

      blockedRoomIds.forEach((roomId) => {
        const typeId = roomTypeByRoomId.get(roomId)
        if (typeId !== undefined && availableRoomsByType[typeId]) {
          availableRoomsByType[typeId].available_count = Math.max(
            0,
            availableRoomsByType[typeId].available_count - 1
          )
        }
      })

      // Count unassigned room reservations by room type (reservation rooms without room assignment)
      const unassignedRoomReservationsByType: {
        [key: string]: {
          room_type_id: number | null
          room_type_name: string
          unassigned_count: number
          unassigned_reservations: Reservation[]
        }
      } = {}

      // Initialize with all room types
      roomTypes.forEach((roomType) => {
        unassignedRoomReservationsByType[roomType.id] = {
          room_type_id: roomType.id,
          room_type_name: roomType.roomTypeName,
          unassigned_count: 0,
          unassigned_reservations: [],
        }
      })

      // Count unassigned reservation rooms by their intended room type
      activeReservationsForDay.forEach((reservation) => {
        reservation.reservationRooms.forEach((rr) => {
          if (!rr.roomId && rr.roomTypeId) {
            const roomTypeId = rr.roomTypeId
            if (unassignedRoomReservationsByType[roomTypeId]) {
              unassignedRoomReservationsByType[roomTypeId].unassigned_count++
              // Check if reservation is not already in the list
              const existingReservation = unassignedRoomReservationsByType[
                roomTypeId
              ].unassigned_reservations.find((r) => r.id === reservation.id)
              if (!existingReservation) {
                unassignedRoomReservationsByType[roomTypeId].unassigned_reservations.push(
                  reservation
                )
              }
            }
          }
        })
      })

      // Calculate room status statistics using sets to avoid per-room scans
      const checkingOutToday = reservations.filter(
        (r) => r.departDate?.hasSame(currentDate, 'day') && r.status === 'checked_in'
      )
      const arrivingToday = reservations.filter(
        (r) => r.arrivedDate?.hasSame(currentDate, 'day') && r.status === 'confirmed'
      )

      const dueOutRooms = new Set<number>()
      checkingOutToday.forEach((r) => {
        r.reservationRooms.forEach((rr) => {
          if (rr.roomId) dueOutRooms.add(rr.roomId)
        })
      })

      const arrivingRooms = new Set<number>()
      arrivingToday.forEach((r) => {
        r.reservationRooms.forEach((rr) => {
          if (rr.roomId) arrivingRooms.add(rr.roomId)
        })
      })

      const blockedSet = new Set<number>(blockedRoomIds)
      staticBlockedOrOO.forEach((id) => blockedSet.add(id))

      const roomStatusStats = {
        all: totalRooms,
        vacant: 0,
        occupied: occupiedEffCount,
        reserved: 0,
        blocked: 0,
        dueOut: 0,
        dirty: 0,
      }

      // dueOut count = occupied rooms departing today
      dueOutRooms.forEach((id) => {
        if (occupiedRoomIds.has(id)) roomStatusStats.dueOut++
      })

      // reserved count = arriving rooms not already occupied
      arrivingRooms.forEach((id) => {
        if (!occupiedRoomIds.has(id)) roomStatusStats.reserved++
      })

      // blocked count = blocked rooms not occupied or reserved
      blockedSet.forEach((id) => {
        if (!occupiedRoomIds.has(id) && !arrivingRooms.has(id)) roomStatusStats.blocked++
      })

      // dirty count = dirty or cleaning rooms not occupied/reserved/blocked
      staticDirtyOrCleaning.forEach((id) => {
        if (!occupiedRoomIds.has(id) && !arrivingRooms.has(id) && !blockedSet.has(id))
          roomStatusStats.dirty++
      })

      roomStatusStats.vacant = Math.max(
        0,
        totalRooms -
        roomStatusStats.occupied -
        roomStatusStats.reserved -
        roomStatusStats.blocked -
        roomStatusStats.dirty
      )

      dailyMetrics.push({
        date: currentDate.toISODate(),
        total_available_rooms: netTotalRooms,
        occupancy_rate: parseFloat(occupancyRate.toFixed(0)),
        allocated_rooms: occupiedEffCount,
        unassigned_reservations: unassignedReservationsCount,
        room_status_stats: roomStatusStats,
        available_rooms_by_type: Object.values(availableRoomsByType),
        unassigned_room_reservations_by_type: Object.values(unassignedRoomReservationsByType),
      })
    }

    // 4. Group reservation details by room type
    const groupedDetails: { [key: string]: any } = {}
    const today = DateTime.now().startOf('day')

    const getReservationStatus = (entity: any, today: DateTime): string => {
      const status = entity.status
      const departureDate =entity.checkOutDate || entity.departDate

      if (status === 'confirmed' || status === 'reserved') {
        return 'confirmed'
      } else if (status === 'request') {
        return 'request'
      } else if (status === 'blocked') {
        return 'blocked'
      } else if (status=='check_out'||status === 'checkout') {
        return 'checkout'
      } else if (status === 'checked_in') {
        if (departureDate?.hasSame(today, 'day')) {
          return 'departure'
        } else {
          return 'inhouse'
        }
      }
      return status
    }

    // Precompute occupied rooms for today
    const todaysOccupiedRooms = new Set<number>()
    reservations.forEach((r) => {
      r.reservationRooms.forEach((rr) => {
        const ci = rr.checkInDate || r.arrivedDate
        const co = rr.checkOutDate || r.departDate
        if (rr.roomId && ci && co && ci <= today && co > today) {
          todaysOccupiedRooms.add(rr.roomId)
        }
      })
    })

    for (const room of allRooms) {
      const roomType = room.roomType?.roomTypeName || 'Uncategorized'
      if (!groupedDetails[roomType]) {
        groupedDetails[roomType] = {
          room_type: roomType,
          order: room.roomType?.sortOrder ?? 0,
          room_type_id: room.roomType?.id,
          total_rooms_of_type: 0,
          room_details: [],
          reservations: [],
        }
      }
      groupedDetails[roomType].total_rooms_of_type++

      let roomStatus = 'Available'
      if (todaysOccupiedRooms.has(room.id)) {
        roomStatus = 'Occupied'
      } else if (room.status && room.status !== 'active') {
        roomStatus = room.status
      }

      groupedDetails[roomType].room_details.push({
        room_number: room.roomNumber ?? room.displayName,
        room_name: room.roomNumber,
        room_type: roomType,
        capacity: room.roomType.maxAdult,
        room_id: room.id,
        room_status: roomStatus,
        room_housekeeping_status: room.housekeepingStatus,
        is_smoking: room.smokingAllowed,
      })
    }

    for (const reservation of reservations) {
      // Calculate balance summary for this reservation
      const balanceSummary = ReservationsController.calculateBalanceSummary(
        reservation.folios || []
      )
      const isBalance = balanceSummary.outstandingBalance > 0

      // Process each reservation room as a separate reservation entry
      if (reservation.reservationRooms.length > 0) {
        reservation.reservationRooms.forEach((reservationRoom, index) => {
          if (reservationRoom.room && reservationRoom.room.roomType) {
            const roomType = reservationRoom.room.roomType.roomTypeName
            const isMaster = (index === 0 && reservation.reservationRooms.length > 1 ) && reservation.isGroup// First reservation room is the master
             let guestName = ''
              if (reservationRoom.guest) {
                // Si la chambre a son propre guest, l'utiliser
                guestName = `${reservationRoom.guest.title || ''} ${reservationRoom.guest.firstName || ''} ${reservationRoom.guest.lastName || ''}`.trim()
              } else if (reservation.guest) {
                // Sinon, fallback au primary guest de la réservation
                guestName = reservation.guest.displayName || `${reservation.guest.title || ''} ${reservation.guest.firstName || ''} ${reservation.guest.lastName || ''}`.trim()
              }

              // Ajouter le nom de la Business Source si disponible
              const businessSourceName = reservation.businessSource?.name
              if (businessSourceName) {
                guestName = guestName ? `${guestName} // ${businessSourceName}` : businessSourceName
              }
            if (groupedDetails[roomType]) {
              groupedDetails[roomType].reservations.push({
                reservation_id: reservation.id,
                reservation_room_id: reservationRoom.id,
                is_master: isMaster,
                guest_name: guestName,
                check_in_date: reservationRoom.checkInDate || reservation.arrivedDate,
                check_out_date: reservationRoom.checkOutDate || reservation.departDate,
                reservation_status: getReservationStatus(reservationRoom, today) || getReservationStatus(reservation, today),
                is_checking_in_today:
                  (reservationRoom.checkInDate || reservation.arrivedDate)?.hasSame(today, 'day') ??
                  false,
                is_checking_out_today:
                  (reservationRoom.checkOutDate || reservation.departDate)?.hasSame(today, 'day') ??
                  false,
                assigned_room_number: reservationRoom.room.roomNumber || null,
                room_id: reservationRoom.roomId,
                check_in_time: reservationRoom.checkInTime,
                check_out_time: reservationRoom.checkOutTime,
                total_guests:
                  reservationRoom.adults + reservationRoom.children || reservation.guestCount || 0,
                adults: reservationRoom.adults || 0,
                children: reservationRoom.children || 0,
                special_requests:
                  reservationRoom.specialRequests || reservation.specialRequests || '',
                reservation_number: reservation.reservationNumber,
                total_amount: reservationRoom.totalAmount || reservation.totalAmount,
                room_rate: reservationRoom.roomRate || 0,
                reservationType: reservation.reservationType,
                customerType: reservation.customerType,
                companyName: reservation.companyName,
                groupName: reservation.groupName,
                remainingAmount: reservation.remainingAmount,
                bookingSource: reservation.bookingSource,
                businessSource: reservation.businessSource,
                totalNights: reservation.numberOfNights,
                paymentStatus: reservation.paymentStatus,
                balance_summary: balanceSummary,
                is_balance: isBalance,
                isWomen: this.isWomanTitle(reservation.guest.title),
                isSplitedOrigin:reservationRoom.isSplitedOrigin,
                isSplitedDestination:reservationRoom.isplitedDestinatination,
                otaName:reservation.otaName
              })
            }
          }
        })
      }
    }

    // Calculate global room status statistics

    const globalRoomStatusStats = {
      all: totalRooms,
      vacant: 0,
      occupied: 0,
      reserved: 0,
      blocked: 0,
      dueOut: 0,
      dirty: 0,
    }




    const allCheckedInReservations = await Reservation.query()
      .select(['id', 'arrived_date', 'depart_date', 'status'])
      .where('hotel_id', hotelId)
      .where('status', 'checked_in')
      .where('depart_date','>=',today.toISODate()!)
      .preload('reservationRooms', (rrq) => {
        rrq.select(['room_id', 'room_type_id', 'check_in_date', 'check_out_date', 'is_splited_origin', 'isplited_destinatination'])
        .preload('roomType', (rt) => rt.select(['id', 'is_paymaster']))
      })


    const dueOutReservations = allCheckedInReservations.filter((reservation) =>
      reservation.reservationRooms.some((rr) => {
        if (!rr.checkOutDate) return false
        return rr.checkOutDate <= today
      })
    )

    const dueOutRoomIds = new Set<number>()

    dueOutReservations.forEach((reservation) => {
      reservation.reservationRooms.forEach((rr) => {
        if (rr.checkOutDate && rr.roomId && rr.checkOutDate <= today) {
          dueOutRoomIds.add(rr.roomId)
        }
      })
    })

    const occupiedEff = allCheckedInReservations.reduce((sum, reservation) => {
      const rrs: any[] = Array.isArray((reservation as any).reservationRooms) ? (reservation as any).reservationRooms : []
      const todayIso = today.toISODate()!
      const coversToday = (rr: any) => {
        const ci = rr.checkInDate ? rr.checkInDate.toISODate() : ''
        const co = rr.checkOutDate ? rr.checkOutDate.toISODate() : ''
        return !!ci && !!co && ci <= todayIso && co > todayIso
      }
      const normalCount = rrs.filter(
          (rr) => coversToday(rr) && rr.roomId && !rr.roomType?.isPaymaster
        ).length
      return sum + normalCount
    }, 0)

    globalRoomStatusStats.dueOut = dueOutRoomIds.size
    console.log('Due out rooms (all checked-in):', globalRoomStatusStats.dueOut)

    const allConfirmedReservations = await Reservation.query()
      .select(['id', 'status'])
      .where('hotel_id', hotelId)
      .where('status', 'confirmed')
      .where('arrived_date', '=', startDate.toISODate()!)
      .preload('reservationRooms', (rrq) => {
        rrq.select(['room_id', 'room_type_id'])
        .preload('roomType', (rt) => rt.select(['id', 'is_paymaster']))
      })

    console.log('Total confirmed reservations:', allConfirmedReservations.length)

    const confirmedRoomIds = new Set<number>()
    allConfirmedReservations.forEach((r) => {
      r.reservationRooms.forEach((rr) => {
        if (rr.roomId && !rr.roomType?.isPaymaster) {
          confirmedRoomIds.add(rr.roomId)
        }
      })
    })

    globalRoomStatusStats.reserved = confirmedRoomIds.size


    globalRoomStatusStats.occupied = occupiedEff

    const allBlockedRoomIds = new Set<number>(staticBlockedOrOO)

    const allRoomBlocks = await RoomBlock.query()
      .select(['id', 'room_id', 'status'])
      .where('hotel_id', hotelId)
      .whereNot('status', 'completed')
      .where((query) => {
        query
          .whereBetween('block_from_date', [
            startDate.toFormat('yyyy-MM-dd'),
            endDate.toFormat('yyyy-MM-dd'),
          ])
          .orWhereBetween('block_to_date', [
            startDate.toFormat('yyyy-MM-dd'),
            endDate.toFormat('yyyy-MM-dd'),
          ])
          .orWhere((subQuery) => {
            subQuery
              .where('block_from_date', '<=', startDate.toFormat('yyyy-MM-dd'))
              .andWhere('block_to_date', '>=', endDate.toFormat('yyyy-MM-dd'))
          })
      })
      .preload('room', (rq) => {
        rq.select(['id'])
      })


    allRoomBlocks.forEach((block) => {
      if (block.room) {
        allBlockedRoomIds.add(block.room.id)
      }
    })

    globalRoomStatusStats.blocked = allBlockedRoomIds.size
    globalRoomStatusStats.dirty = staticDirtyOrCleaning.size
    globalRoomStatusStats.vacant = Math.max(
      0,
      totalRooms -
      globalRoomStatusStats.occupied -
      globalRoomStatusStats.blocked
    )



    // Sort grouped details by the 'order' field ascending
    const groupedDetailsSorted = Object.values(groupedDetails).sort((a: any, b: any) => {
      return (a.order ?? 0) - (b.order ?? 0)
    })

    return {
      daily_occupancy_metrics: dailyMetrics,
      grouped_reservation_details: groupedDetailsSorted,
      global_room_status_stats: globalRoomStatusStats,
      room_blocks: roomBlocks.map((block) => ({
        id: block.id,
        block_from_date: block.blockFromDate,
        block_to_date: block.blockToDate,
        reason: block.reason,
        status: block.status,
        room: block.room
          ? {
            id: block.room.id,
            room_number: block.room.roomNumber,
            floor_number: block.room.floorNumber,
          }
          : null,
        room_type: block.roomType
          ? {
            id: block.roomType.id,
            name: block.roomType.roomTypeName,
          }
          : null,
        created_at: block.createdAt,
        updated_at: block.updatedAt,
      })),
    }
  }
}
