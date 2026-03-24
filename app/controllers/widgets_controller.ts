import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Room from '#models/room'
import Reservation from '#models/reservation'
import ReservationRoom from '#models/reservation_room'
import WorkOrder from '#models/work_order'
import RoomBlock from '#models/room_block'
import Database from '@adonisjs/lucid/services/db'

export default class WidgetsController {
  public async dashboard(ctx: HttpContext) {
    const {  request, response } = ctx

    try {
      const hotelId = Number(request.input('hotelId'))

      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'hotelId est obligatoire via la query (?hotelId=)',
        })
      }

      const now = DateTime.now()
      const hour = now.hour
      const todayStr = now.toFormat('yyyy-MM-dd')

      const mode: 'morning' | 'afternoon' | 'evening' =
        hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening'

      // Parallelize queries
      const [
        totalRoomsResult,
        occupiedRoomsResult,
        arrivalsCountResult,
        departuresCountResult,
        blockedRoomIdsRows,
        housekeepingCountsRows,
        urgentAlertsResult,
      ] = await Promise.all([
        Room.query().where('hotel_id', hotelId).count('* as total'),
        ReservationRoom.query()
          .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
          .where('reservations.hotel_id', hotelId)
          .where('reservation_rooms.status', 'checked_in')
          .where('reservations.check_in_date', '<=', todayStr)
          .where('reservations.check_out_date', '>', todayStr)
          .countDistinct('reservation_rooms.room_id as total'),
        Reservation.query()
          .where('hotel_id', hotelId)
          .whereRaw('DATE(arrived_date) = ?', [todayStr])
          .whereIn('status', ['confirmed', 'checked_in'])
          .count('* as total'),
        Reservation.query()
          .where('hotel_id', hotelId)
          .whereRaw('DATE(depart_date) = ?', [todayStr])
          .whereIn('status', ['checked_in', 'checked_out'])
          .count('* as total'),
        RoomBlock.query()
          .where('hotel_id', hotelId)
          .where('block_from_date', '<=', todayStr)
          .where('block_to_date', '>=', todayStr)
          .whereNot('status', 'completed')
          .select('room_id')
          .distinct('room_id'),
        Database.from('rooms')
          .where('hotel_id', hotelId)
          .groupBy('housekeeping_status')
          .select('housekeeping_status')
          .count('* as total'),
        WorkOrder.query()
          .where('hotel_id', hotelId)
          .where('priority', 'high')
          .whereNot('status', 'completed')
          .count('* as total'),
      ])

      const totalRooms = Number((totalRoomsResult[0] as any).$extras.total || 0)
      const occupiedRooms = Number((occupiedRoomsResult[0] as any).$extras.total || 0)
      const arrivals = Number((arrivalsCountResult[0] as any).$extras.total || 0)
      const departures = Number((departuresCountResult[0] as any).$extras.total || 0)
      const urgentAlerts = Number((urgentAlertsResult[0] as any).$extras.total || 0)

      const blockedIds = blockedRoomIdsRows.map((r: any) => Number(r.room_id))

      // Rooms to clean = rooms marked dirty, excluding blocked rooms
      const dirtyCountRow = housekeepingCountsRows.find(
        (r: any) => r.housekeeping_status === 'dirty'
      )
      const totalDirty = Number((dirtyCountRow && dirtyCountRow.total) || 0)

      let roomsToClean = totalDirty
      if (blockedIds.length > 0 && totalDirty > 0) {
        const dirtyUnblocked = await Room.query()
          .where('hotel_id', hotelId)
          .where('housekeeping_status', 'dirty')
          .whereNotIn('id', blockedIds)
          .count('* as total')
        roomsToClean = Number((dirtyUnblocked[0] as any).$extras.total || 0)
      }

      const occupancyRate =
        totalRooms > 0 ? Math.round(((occupiedRooms / totalRooms) * 100 + Number.EPSILON)) : 0

      const focusAll = ['departures', 'roomsToClean', 'arrivals', 'occupancy', 'alerts']
      let primary: string[] = []
      if (mode === 'morning') primary = ['departures', 'roomsToClean']
      else if (mode === 'afternoon') primary = ['arrivals']
      else primary = ['occupancy', 'alerts']

      const secondary = focusAll.filter((k) => !primary.includes(k))

      const payload = {
        mode,
        occupancy: {
          totalRooms,
          occupiedRooms,
          rate: occupancyRate,
        },
        today: {
          arrivals,
          departures,
        },
        housekeeping: {
          roomsToClean,
        },
        alerts: {
          urgent: urgentAlerts,
        },
        focus: {
          primary,
          secondary,
        },
      }

      return response.ok(payload)
    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Failed to load widget dashboard',
        error: error.message,
      })
    }
  }
}
