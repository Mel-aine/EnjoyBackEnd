import Reservation from '#models/reservation'
import { DateTime } from 'luxon'
import Room from '#models/room'

export class HotelAnalyticsService {
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

        // 2. Get all relevant reservations that overlap with the date range
        const reservations = await Reservation.query()
            .where('hotel_id', hotelId)

            .where('depart_date', '>=', startDate.toISODate()!)
            .where('arrived_date', '<=', endDate.toISODate()!)
            .whereNotIn('status', ['cancelled', 'no-show','no_show','voided'])
            .preload('guest')
            .preload('reservationRooms', (rspQuery) => {
                rspQuery.preload('room', (spQuery) => {
                    spQuery.preload('roomType')
                })
            })

        // 3. Calculate daily occupancy metrics
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
            })
        }

        for (const reservation of reservations) {
            // Group reservation by the room types of its assigned rooms
            const reservationRoomTypes = new Set<string>()
            const assignedRooms: { roomNumber: string | null; roomType: string }[] = []

            if (reservation.reservationRooms.length > 0) {
                for (const rsp of reservation.reservationRooms) {
                    if (rsp.room && rsp.room.roomType) {
                        const roomType = rsp.room.roomType.roomTypeName
                        reservationRoomTypes.add(roomType)
                        assignedRooms.push({ roomNumber: rsp.room.roomNumber, roomType })
                    }
                }
            }

            for (const roomType of reservationRoomTypes) {
                if (groupedDetails[roomType]) {
                    // Avoid adding the same reservation multiple times to the same room type group
                    if (groupedDetails[roomType].reservations.find((r: any) => r.reservation_id === reservation.id)) {
                        continue
                    }

                    // Find the first assigned room number of this type for this reservation
                    const assignedRoomForType = assignedRooms.find((r) => r.roomType === roomType)

                    groupedDetails[roomType].reservations.push({
                        reservation_id: reservation.id,
                        guest_name: `${reservation.guest?.firstName || ''} ${reservation.guest?.lastName || ''
                            }`.trim(),
                        check_in_date: reservation.arrivedDate,
                        check_out_date: reservation.departDate,
                        reservation_status: getReservationStatus(reservation, today),
                        is_checking_in_today: reservation.arrivedDate?.hasSame(today, 'day') ?? false,
                        is_checking_out_today: reservation.departDate?.hasSame(today, 'day') ?? false,
                        assigned_room_number: assignedRoomForType?.roomNumber || null,
                        total_guests: reservation.guestCount || 0,
                        special_requests: reservation.specialRequests || '',
                        reservation_number: reservation.reservationNumber,
                        total_amount: reservation.totalAmount,
                        reservationType: reservation.reservationType,
                        customerType: reservation.customerType,
                        companyName: reservation.companyName,
                        groupName: reservation.groupName,
                        remainingAmount: reservation.remainingAmount,
                        bookingSource: reservation.bookingSource,
                        totalNights: reservation.numberOfNights,
                        paymentStatus: reservation.paymentStatus,
                    })
                }
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
        }
    }
}


