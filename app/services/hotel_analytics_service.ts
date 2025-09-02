import Reservation from '#models/reservation'
import { DateTime } from 'luxon'
import Room from '#models/room'
import RoomBlock from '#models/room_block'

export class HotelAnalyticsService {
    /**
     * Determine if a guest is a woman based on their title
     */
    private static isWomanTitle(title: string): boolean {
        if (!title) return false
        
        const womenTitles = [
            'ms', 'mrs', 'miss', 'madam', 'madame', 'lady', 'dame',
            'ms.', 'mrs.', 'miss.', 'madam.', 'madame.', 'lady.', 'dame.',
            'girl', 'girls', 'woman', 'women', 'female'
        ]
        
        return womenTitles.includes(title.toLowerCase().trim())
    }

    /**
     * Calculate balance summary from folios and their transactions
     */
    private static calculateBalanceSummary(folios: any[]) {
        let totalCharges = 0
        let totalPayments = 0
        let totalAdjustments = 0
        let totalTaxes = 0
        let totalServiceCharges = 0
        let totalDiscounts = 0

        folios.forEach(folio => {
            if (folio.transactions) {
                folio.transactions.forEach((transaction: any) => {
                    const amount = parseFloat(transaction.amount) || 0

                    switch (transaction.transactionType) {
                        case 'charge':
                            totalCharges += amount
                            break
                        case 'payment':
                            totalPayments += amount
                            break
                        case 'adjustment':
                            totalAdjustments += amount
                            break
                        case 'tax':
                            totalTaxes += amount
                            break
                        case 'discount':
                            totalDiscounts += Math.abs(amount) // Discounts are typically negative
                            break
                        case 'refund':
                            totalPayments -= amount // Refunds reduce payments
                            break
                    }

                    // Add service charges and taxes from transaction details
                    if (transaction.serviceChargeAmount) {
                        totalServiceCharges += parseFloat(transaction.serviceChargeAmount) || 0
                    }
                    if (transaction.taxAmount) {
                        totalTaxes += parseFloat(transaction.taxAmount) || 0
                    }
                })
            }
        })

        const outstandingBalance = totalCharges + totalTaxes + totalServiceCharges - totalPayments - totalDiscounts + totalAdjustments

        return {
            totalCharges: parseFloat(totalCharges.toFixed(2)),
            totalPayments: parseFloat(totalPayments.toFixed(2)),
            totalAdjustments: parseFloat(totalAdjustments.toFixed(2)),
            totalTaxes: parseFloat(totalTaxes.toFixed(2)),
            totalServiceCharges: parseFloat(totalServiceCharges.toFixed(2)),
            totalDiscounts: parseFloat(totalDiscounts.toFixed(2)),
            outstandingBalance: parseFloat(outstandingBalance.toFixed(2)),
            totalChargesWithTaxes: parseFloat((totalCharges + totalTaxes).toFixed(2)),
            balanceStatus: outstandingBalance > 0 ? 'outstanding' : outstandingBalance < 0 ? 'credit' : 'settled'
        }
    }

    public static async getDailyOccupancyAndReservations(
        hotelId: number,
        startDate: DateTime,
        endDate: DateTime
    ) {
        // 1. Get all rooms for the service
        const allRooms = await Room.query()
            .where('hotel_id', hotelId)
            .preload('roomType')

        const totalRooms = allRooms.length

        if (totalRooms === 0) {
            return {
                daily_occupancy_metrics: [],
                grouped_reservation_details: [],
            }
        }

        // 2. Get all room types for the hotel
        const roomTypes = await Room.query()
            .where('hotel_id', hotelId)
            .preload('roomType')
            .then(rooms => {
                const uniqueTypes = new Map()
                rooms.forEach(room => {
                    if (room.roomType) {
                        uniqueTypes.set(room.roomType.id, room.roomType)
                    }
                })
                return Array.from(uniqueTypes.values())
            })

        // 3. Get all relevant reservations that overlap with the date range
        const reservations = await Reservation.query()
            .where('hotel_id', hotelId)

            .where('depart_date', '>=', startDate.toISODate()!)
            .where('arrived_date', '<=', endDate.toISODate()!)
            .whereNotIn('status', ['cancelled', 'no-show','no_show','voided'])
            .preload('reservationRooms', (rspQuery) => {
                rspQuery.preload('room', (spQuery) => {
                    spQuery.preload('roomType')
                })
            })

        // 4. Calculate daily occupancy metrics
        const dailyMetrics = []
        for (let dt = startDate; dt <= endDate; dt = dt.plus({ days: 1 })) {
            const currentDate = dt

            const activeReservationsForDay = reservations.filter(
                (r) =>
                    r.arrivedDate && r.departDate && r.arrivedDate <= currentDate && r.departDate > currentDate
            )

            const occupiedRoomIds = new Set<number>()
            let unassignedReservationsCount = 0

            for (const reservation of activeReservationsForDay) {
                let isAssignedForToday = false
                if (reservation.reservationRooms.length > 0) {
                    for (const rsp of reservation.reservationRooms) {
                        if (rsp.id) {
                            occupiedRoomIds.add(rsp.id)
                            isAssignedForToday = true
                        }
                    }
                }

                if (!isAssignedForToday) {
                    unassignedReservationsCount++
                }
            }

            const occupancyRate = totalRooms > 0 ? (occupiedRoomIds.size / totalRooms) * 100 : 0

            // Calculate available rooms per room type
            const availableRoomsByType: { [key: string]: { room_type_id: number, room_type_name: string, available_count: number } } = {}
            
            // Initialize with all room types
            roomTypes.forEach(roomType => {
                availableRoomsByType[roomType.id] = {
                    room_type_id: roomType.id,
                    room_type_name: roomType.roomTypeName,
                    available_count: 0
                }
            })

            // Get blocked room IDs for this specific date
            const blockedRoomIds = new Set<number>()
            const roomBlocksForDate = await RoomBlock.query()
                .where('hotel_id', hotelId)
                .where('block_from_date', '<=', currentDate.toFormat('yyyy-MM-dd'))
                .where('block_to_date', '>=', currentDate.toFormat('yyyy-MM-dd'))
                .preload('room')
            
            roomBlocksForDate.forEach(block => {
                if (block.room) {
                    blockedRoomIds.add(block.room.id)
                }
            })

            // Get all room IDs that have reservations for this specific date (not just occupied)
            const reservedRoomIds = new Set<number>()
            activeReservationsForDay.forEach(reservation => {
                reservation.reservationRooms.forEach(rr => {
                    if (rr.roomId) {
                        reservedRoomIds.add(rr.roomId)
                    }
                })
            })

            // Count available rooms by type (exclude reserved, blocked, and maintenance rooms)
            allRooms.forEach(room => {
                if (room.roomTypeId && 
                    !reservedRoomIds.has(room.id) && 
                    !blockedRoomIds.has(room.id) &&
                    room.status !== 'blocked' &&
                    room.status !== 'out_of_order' &&
                    room.status !== 'maintenance' &&
                    room.housekeepingStatus !== 'out_of_order') {
                    if (availableRoomsByType[room.roomTypeId]) {
                        availableRoomsByType[room.roomTypeId].available_count++
                    }
                }
            })

            // Count unassigned room reservations by room type (reservation rooms without room assignment)
            const unassignedRoomReservationsByType: { [key: string]: { room_type_id: number | null, room_type_name: string, unassigned_count: number } } = {}
            
            // Initialize with all room types
            roomTypes.forEach(roomType => {
                unassignedRoomReservationsByType[roomType.id] = {
                    room_type_id: roomType.id,
                    room_type_name: roomType.roomTypeName,
                    unassigned_count: 0
                }
            })

            // Add "Unknown" category for reservations without room type
            unassignedRoomReservationsByType['unknown'] = {
                room_type_id: null,
                room_type_name: 'Unknown',
                unassigned_count: 0
            }

            // Count unassigned reservation rooms by their intended room type
            activeReservationsForDay.forEach(reservation => {
                reservation.reservationRooms.forEach(rr => {
                    if (!rr.roomId) {
                        const roomTypeId = rr.roomTypeId || 'unknown'
                        if (unassignedRoomReservationsByType[roomTypeId]) {
                            unassignedRoomReservationsByType[roomTypeId].unassigned_count++
                        }
                    }
                })
            })

            // Calculate room status statistics
            const roomStatusStats = {
                all: totalRooms,
                vacant: 0,
                occupied: 0,
                reserved: 0,
                blocked: 0,
                dueOut: 0,
                dirty: 0
            }

            // Get reservations checking out today
            const checkingOutToday = reservations.filter(
                (r) => r.departDate?.hasSame(currentDate, 'day') && r.status === 'checked_in'
            )

            // Get reservations arriving today
            const arrivingToday = reservations.filter(
                (r) => r.arrivedDate?.hasSame(currentDate, 'day') && r.status === 'confirmed'
            )

            for (const room of allRooms) {
                const isOccupied = occupiedRoomIds.has(room.id)
                const isDueOut = checkingOutToday.some(r => 
                    r.reservationRooms.some(rr => rr.roomId === room.id)
                )
                const isReserved = arrivingToday.some(r => 
                    r.reservationRooms.some(rr => rr.roomId === room.id)
                )
                
                if (isOccupied) {
                    roomStatusStats.occupied++
                    if (isDueOut) {
                        roomStatusStats.dueOut++
                    }
                } else if (isReserved) {
                    roomStatusStats.reserved++
                } else if (room.status === 'blocked' || room.status === 'out_of_order') {
                    roomStatusStats.blocked++
                } else if (room.housekeepingStatus === 'dirty' || room.housekeepingStatus === 'cleaning') {
                    roomStatusStats.dirty++
                } else {
                    roomStatusStats.vacant++
                }
            }

            dailyMetrics.push({
                date: currentDate.toISODate(),
                total_available_rooms: totalRooms,
                occupancy_rate: parseFloat(occupancyRate.toFixed(2)),
                allocated_rooms: occupiedRoomIds.size,
                unassigned_reservations: unassignedReservationsCount,
                room_status_stats: roomStatusStats,
                available_rooms_by_type: Object.values(availableRoomsByType),
                unassigned_room_reservations_by_type: Object.values(unassignedRoomReservationsByType),
            })
        }

        // 4. Group reservation details by room type
        const groupedDetails: { [key: string]: any } = {}
        const today = DateTime.now().startOf('day')

        const getReservationStatus = (reservation: Reservation, today: DateTime): string => {
            if (reservation.status === 'confirmed') {
                return 'confirmed'
            } else if (reservation.status === 'request') {
                return 'request'
            } else if (reservation.status === 'blocked') {
                return 'blocked'
            } else if (reservation.status === 'checkout') {
                return 'checkout'
            } else if (reservation.status === 'checked_in') {
                if (reservation.departDate?.hasSame(today, 'day')) {
                    return 'departure'
                } else {
                    return 'inhouse'
                }
            }
            return reservation.status
        }

        for (const room of allRooms) {
            const roomType = room.roomType?.roomTypeName || 'Uncategorized'
            if (!groupedDetails[roomType]) {
                groupedDetails[roomType] = {
                    room_type: roomType,
                    room_type_id:room.roomType?.id,
                    total_rooms_of_type: 0,
                    room_details: [],
                    reservations: [],
                }
            }
            groupedDetails[roomType].total_rooms_of_type++

            // Find if there's a booking for this specific room today
            const todaysBooking = reservations
                .flatMap((r) => r.reservationRooms)
                .find((rsp) => rsp.roomId === room.id && rsp.checkInDate <= today && rsp.checkInDate > today)

            let roomStatus = 'Available'
            if (todaysBooking) {
                roomStatus = 'Occupied'
            } else if (room.status && room.status !== 'active') {
                // Assuming room model has a status field for maintenance, cleaning, etc.
                roomStatus = room.status
            }

            groupedDetails[roomType].room_details.push({
                room_number: room.roomNumber??room.displayName,
                room_name: room.roomNumber,
                room_type: roomType,
                capacity: room.roomType.maxAdult,
                room_id: room.id,
                room_status: roomStatus,
                room_housekeeping_status: room.housekeepingStatus,
                is_smoking:room.smokingAllowed
            })
        }

        for (const reservation of reservations) {
            // Calculate balance summary for this reservation
            const balanceSummary = this.calculateBalanceSummary(reservation.folios || [])
            const isBalance = balanceSummary.outstandingBalance > 0

            // Process each reservation room as a separate reservation entry
            if (reservation.reservationRooms.length > 0) {
                reservation.reservationRooms.forEach((reservationRoom, index) => {
                    if (reservationRoom.room && reservationRoom.room.roomType) {
                        const roomType = reservationRoom.room.roomType.roomTypeName
                        const isMaster = index === 0 && reservation.reservationRooms.length >1 // First reservation room is the master

                        if (groupedDetails[roomType]) {
                            groupedDetails[roomType].reservations.push({
                                reservation_id: reservation.id,
                                reservation_room_id: reservationRoom.id,
                                is_master: isMaster,
                                guest_name: `${reservation.guest.displayName}`.trim(),
                                check_in_date: reservationRoom.checkInDate || reservation.arrivedDate,
                                check_out_date: reservationRoom.checkOutDate || reservation.departDate,
                                reservation_status: getReservationStatus(reservation, today),
                                is_checking_in_today: (reservationRoom.checkInDate || reservation.arrivedDate)?.hasSame(today, 'day') ?? false,
                                is_checking_out_today: (reservationRoom.checkOutDate || reservation.departDate)?.hasSame(today, 'day') ?? false,
                                assigned_room_number: reservationRoom.room.roomNumber || null,
                                room_id: reservationRoom.roomId,
                                total_guests: reservationRoom.adults + reservationRoom.children || reservation.guestCount || 0,
                                adults: reservationRoom.adults || 0,
                                children: reservationRoom.children || 0,
                                special_requests: reservationRoom.specialRequests || reservation.specialRequests || '',
                                reservation_number: reservation.reservationNumber,
                                total_amount: reservationRoom.totalAmount || reservation.totalAmount,
                                room_rate: reservationRoom.roomRate || 0,
                                reservationType: reservation.reservationType,
                                customerType: reservation.customerType,
                                companyName: reservation.companyName,
                                groupName: reservation.groupName,
                                remainingAmount: reservation.remainingAmount,
                                bookingSource: reservation.bookingSource,
                                totalNights: reservation.numberOfNights,
                                paymentStatus: reservation.paymentStatus,
                                balance_summary: balanceSummary,
                                is_balance: isBalance,
                                isWomen: this.isWomanTitle(reservation.guest.title),
                            })
                        }
                    }
                })
            } else {
                // Handle reservations without assigned rooms (fallback to original logic)
                const roomType = 'Unassigned'
                if (!groupedDetails[roomType]) {
                    groupedDetails[roomType] = {
                        room_type: roomType,
                        room_type_id: null,
                        total_rooms_of_type: 0,
                        room_details: [],
                        reservations: [],
                    }
                }

                groupedDetails[roomType].reservations.push({
                    reservation_id: reservation.id,
                    reservation_room_id: null,
                    is_master: true,
                    guest_name: `${reservation.guest.displayName}`.trim(),
                    check_in_date: reservation.arrivedDate,
                    check_out_date: reservation.departDate,
                    reservation_status: getReservationStatus(reservation, today),
                    is_checking_in_today: reservation.arrivedDate?.hasSame(today, 'day') ?? false,
                    is_checking_out_today: reservation.departDate?.hasSame(today, 'day') ?? false,
                    assigned_room_number: null,
                    room_id: null,
                    total_guests: reservation.guestCount || 0,
                    adults: 0,
                    children: 0,
                    special_requests: reservation.specialRequests || '',
                    reservation_number: reservation.reservationNumber,
                    total_amount: reservation.totalAmount,
                    room_rate: 0,
                    reservationType: reservation.reservationType,
                    customerType: reservation.customerType,
                    companyName: reservation.companyName,
                    groupName: reservation.groupName,
                    remainingAmount: reservation.remainingAmount,
                    bookingSource: reservation.bookingSource,
                    totalNights: reservation.numberOfNights,
                    paymentStatus: reservation.paymentStatus,
                    balance_summary: balanceSummary,
                    is_balance: isBalance,
                    isWomen: this.isWomanTitle(reservation.guest.title),
                })
            }
        }

        // Calculate global room status statistics across all dates
        const globalRoomStatusStats = {
            all: totalRooms,
            vacant: 0,
            occupied: 0,
            reserved: 0,
            blocked: 0,
            dueOut: 0,
            dirty: 0
        }

        // Get all reservations within the date range for global calculations
        const allActiveReservations = reservations.filter(
            (r) => r.arrivedDate && r.departDate && 
                   r.arrivedDate <= endDate && r.departDate >= startDate
        )

        // Get all occupied room IDs across the entire date range
        const globalOccupiedRoomIds = new Set<number>()
        allActiveReservations.forEach(reservation => {
            reservation.reservationRooms.forEach(rr => {
                if (rr.roomId) {
                    globalOccupiedRoomIds.add(rr.roomId)
                }
            })
        })

        // Get reservations checking out within the date range
        const checkingOutInRange = reservations.filter(
            (r) => r.departDate && r.departDate >= startDate && r.departDate <= endDate && r.status === 'checked_in'
        )

        // Get reservations arriving within the date range
        const arrivingInRange = reservations.filter(
            (r) => r.arrivedDate && r.arrivedDate >= startDate && r.arrivedDate <= endDate && r.status === 'confirmed'
        )

        // Get room blocks within the same time frame
        const roomBlocks = await RoomBlock.query()
            .where('hotel_id', hotelId)
            .where((query) => {
                query
                    .whereBetween('block_from_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
                    .orWhereBetween('block_to_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
                    .orWhere((subQuery) => {
                        subQuery
                            .where('block_from_date', '<=', startDate.toFormat('yyyy-MM-dd'))
                            .andWhere('block_to_date', '>=', endDate.toFormat('yyyy-MM-dd'))
                    })
            })
            .preload('room')
            .preload('blockedBy')
            .preload('roomType')
            .orderBy('block_from_date', 'desc')

        // Calculate global room status for each room
        for (const room of allRooms) {
            const isOccupied = globalOccupiedRoomIds.has(room.id)
            const isDueOut = checkingOutInRange.some(r => 
                r.reservationRooms.some(rr => rr.roomId === room.id)
            )
            const isReserved = arrivingInRange.some(r => 
                r.reservationRooms.some(rr => rr.roomId === room.id)
            )
            
            if (isOccupied) {
                globalRoomStatusStats.occupied++
                if (isDueOut) {
                    globalRoomStatusStats.dueOut++
                }
            } else if (isReserved) {
                globalRoomStatusStats.reserved++
            } else if (room.status === 'blocked' || room.status === 'out_of_order') {
                globalRoomStatusStats.blocked++
            } else if (room.housekeepingStatus === 'dirty' || room.housekeepingStatus === 'cleaning') {
                globalRoomStatusStats.dirty++
            } else {
                globalRoomStatusStats.vacant++
            }
        }

        return {
            daily_occupancy_metrics: dailyMetrics,
            grouped_reservation_details: Object.values(groupedDetails),
            global_room_status_stats: globalRoomStatusStats,
            room_blocks: roomBlocks.map(block => ({
                 id: block.id,
                 block_from_date: block.blockFromDate,
                 block_to_date: block.blockToDate,
                 reason: block.reason,
                 status: block.status,
                 room: block.room ? {
                     id: block.room.id,
                     room_number: block.room.roomNumber,
                     floor_number: block.room.floorNumber
                 } : null,
                 room_type: block.roomType ? {
                     id: block.roomType.id,
                     name: block.roomType.roomTypeName
                 } : null,
                 created_at: block.createdAt,
                 updated_at: block.updatedAt
             })),
        }
    }
}


