import { DateTime } from 'luxon'
import Reservation from '../models/reservation.js'
import Hotel from '../models/hotel.js'
import RoomType from '../models/room_type.js'
import { ChannexService } from '../services/channex_service.js'
import ReservationRoomService from '../services/reservation_room_service.js'

/**
 * ReservationHook
 * Background notifications to Channel Manager (Channex) on reservation events.
 */
export default class ReservationHook {
  /**
   * Notify Channex to adjust availability offsets for the impacted date range
   * when a reservation is created. Runs asynchronously to avoid blocking the UI.
   */
  public static notifyAvailabilityOnCreate(reservation: Reservation) {
    // Fire-and-forget to avoid interrupting the user flow
    setTimeout(async () => {
      try {
        const hotel = await Hotel.find(reservation.hotelId)
        if (!hotel || !hotel.channexPropertyId) {
          return
        }

        // Determine impacted room type
        let roomTypeId: number | null = reservation.primaryRoomTypeId || (reservation as any).roomTypeId || null
        if (!roomTypeId) {
          // Fallback: try first reservation room if available
          try {
            await reservation.load('reservationRooms')
            const firstRoom = reservation.reservationRooms?.[0]
            roomTypeId = firstRoom ? (firstRoom as any).roomTypeId || (firstRoom as any).room_type_id || null : null
          } catch {
            // ignore preload errors
          }
        }
        if (!roomTypeId) {
          return
        }

        const roomType = await RoomType.find(roomTypeId)
        // Date range
        const arrival = reservation.scheduledArrivalDate || reservation.checkInDate
        const departure = reservation.scheduledDepartureDate || reservation.checkOutDate
        if (!arrival || !departure) {
          return
        }

        const dateFrom = (arrival as DateTime).toISODate()
        const dateTo = (departure as DateTime).toISODate()

        // Quantity of rooms to offset (default 1)
        const roomsQty = reservation.roomsRequested && reservation.roomsRequested > 0 ? reservation.roomsRequested : 1

        // Require a mapped Channex room_type_id to adjust availability
        if (!roomType?.channexRoomTypeId) {
          return
        }

        // Compute absolute availability: available rooms minus newly reserved quantity
        const rrService = new ReservationRoomService()
        const availableRooms = await rrService.findAvailableRooms(
          reservation.hotelId,
          (arrival as DateTime).toJSDate(),
          (departure as DateTime).toJSDate(),
          roomTypeId || undefined
        )

        const availableCount = Math.max(0, availableRooms.length - roomsQty)

        const channexService = new ChannexService()
        // Update availability with absolute value for the impacted range
        const payload = {
          values: [
            {
              room_type_id: roomType.channexRoomTypeId,
              property_id: hotel.channexPropertyId,
              date_from: dateFrom,
              date_to: dateTo,
              availability: availableCount,
            },
          ],
        }

        await channexService.updateAvailability(hotel.channexPropertyId, payload)
      } catch (err) {
        console.error('Channex availability notification failed:', err)
      }
    }, 0)
  }
}