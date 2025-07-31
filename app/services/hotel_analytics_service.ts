import ServiceProduct from '#models/service_product'
import Reservation from '#models/reservation'
import { DateTime } from 'luxon'

export class HotelAnalyticsService {
    public static async getDailyOccupancyAndReservations(
        serviceId: number,
        startDate: DateTime,
        endDate: DateTime
    ) {
        // 1. Get all rooms for the service
        const allRooms = await ServiceProduct.query()
            .where('service_id', serviceId)
            .preload('productType')
        const totalRooms = allRooms.length

        if (totalRooms === 0) {
            return {
                daily_occupancy_metrics: [],
                grouped_reservation_details: [],
            }
        }

        // 2. Get all relevant reservations that overlap with the date range
        const reservations = await Reservation.query()
            .where('service_id', serviceId)
            .where('depart_date', '>', startDate.toISODate()!)
            .where('arrived_date', '<', endDate.toISODate()!)
            .whereNotIn('status', ['cancelled', 'no-show'])
            .preload('user')
            .preload('reservationServiceProducts', (rspQuery) => {
                rspQuery.preload('serviceProduct', (spQuery) => {
                    spQuery.preload('productType')
                })
            })

        // 3. Calculate daily occupancy metrics
        const dailyMetrics = []
        for (let dt = startDate; dt <= endDate; dt = dt.plus({ days: 1 })) {
            const currentDate = dt

            const activeReservationsForDay = reservations.filter(
                (r) =>
                    r.arrived_date && r.depart_date && r.arrived_date <= currentDate && r.depart_date > currentDate
            )

            const occupiedRoomIds = new Set<number>()
            let unassignedReservationsCount = 0

            for (const reservation of activeReservationsForDay) {
                let isAssignedForToday = false
                if (reservation.reservationServiceProducts.length > 0) {
                    for (const rsp of reservation.reservationServiceProducts) {
                        if (rsp.service_product_id) {
                            occupiedRoomIds.add(rsp.serviceProductId)
                            isAssignedForToday = true
                        }
                    }
                }

                if (!isAssignedForToday) {
                    unassignedReservationsCount++
                }
            }

            const occupancyRate = totalRooms > 0 ? (occupiedRoomIds.size / totalRooms) * 100 : 0

            dailyMetrics.push({
                date: currentDate.toISODate(),
                total_available_rooms: totalRooms,
                occupancy_rate: parseFloat(occupancyRate.toFixed(2)),
                allocated_rooms: occupiedRoomIds.size,
                unassigned_reservations: unassignedReservationsCount,
            })
        }

        // 4. Group reservation details by room type
        const groupedDetails: { [key: string]: any } = {}
        const today = DateTime.now().startOf('day')

        for (const room of allRooms) {
            const roomType = room.productType?.name || 'Uncategorized'
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
                .flatMap((r) => r.reservationServiceProducts)
                .find((rsp) => rsp.serviceProductId === room.id && rsp.start_date <= today && rsp.end_date > today)

            let roomStatus = 'Available'
            if (todaysBooking) {
                roomStatus = 'Occupied'
            } else if (room.status && room.status !== 'active') {
                // Assuming room model has a status field for maintenance, cleaning, etc.
                roomStatus = room.status
            }

            groupedDetails[roomType].room_details.push({
                room_number: room.room_number??room.product_name,
                room_name: room.product_name,
                room_type: roomType,
                capacity: room.capacity,
                room_id: room.id,
                room_status: roomStatus,
            })
        }

        for (const reservation of reservations) {
            // Group reservation by the room types of its assigned rooms
            const reservationRoomTypes = new Set<string>()
            const assignedRooms: { roomNumber: string | null; roomType: string }[] = []

            if (reservation.reservationServiceProducts.length > 0) {
                for (const rsp of reservation.reservationServiceProducts) {
                    if (rsp.serviceProduct && rsp.serviceProduct.productType) {
                        const roomType = rsp.serviceProduct.productType.name
                        reservationRoomTypes.add(roomType)
                        assignedRooms.push({ roomNumber: rsp.serviceProduct.room_number??rsp.serviceProduct.product_name, roomType })
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
                        guest_name: `${reservation.user?.first_name || ''} ${reservation.user?.last_name || ''
                            }`.trim(),
                        check_in_date: reservation.arrived_date,
                        check_out_date: reservation.depart_date,
                        reservation_status: reservation.status,
                        is_checking_in_today: reservation.arrived_date?.hasSame(today, 'day') ?? false,
                        is_checking_out_today: reservation.depart_date?.hasSame(today, 'day') ?? false,
                        assigned_room_number: assignedRoomForType?.roomNumber || null,
                        total_guests: reservation.guest_count || 0,
                        special_requests: reservation.special_requests || '',
                        reservation_number: reservation.reservation_number,
                        total_amount: reservation.total_amount,
                        reservation_type: reservation.reservation_type,
                        customer_type: reservation.customer_type,
                        company_name: reservation.company_name,
                        group_name: reservation.group_name,
                        remaining_amount: reservation.remaining_amount,
                        booking_source: reservation.booking_source,
                        total_nights: reservation.number_of_nights,
                        payment_status: reservation.payment_status,
                    })
                }
            }
        }

        return {
            daily_occupancy_metrics: dailyMetrics,
            grouped_reservation_details: Object.values(groupedDetails),
        }
    }
}


