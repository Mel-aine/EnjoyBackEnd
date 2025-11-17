import { DateTime } from 'luxon'
import Reservation from '../models/reservation.js'
import Hotel from '../models/hotel.js'
import RoomType from '../models/room_type.js'
import { ChannexService } from '../services/channex_service.js'
import LoggerService from '#services/logger_service'
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
    setTimeout(async () => {
      try {
        const hotel = await Hotel.find(reservation.hotelId)
        if (!hotel || !hotel.channexPropertyId) {
          return
        }

        await reservation.load('reservationRooms')
        const rtIdsSet = new Set<number>()
        for (const rr of reservation.reservationRooms || []) {
          const rid = (rr as any).roomTypeId || (rr as any).room_type_id
          if (rid) rtIdsSet.add(rid)
        }
        if (rtIdsSet.size === 0) {
          return
        }

        const arrival = reservation.arrivedDate
        const departure = reservation.departDate
        if (!arrival || !departure) {
          return
        }

        const rtIds = Array.from(rtIdsSet)
        const roomTypes = await RoomType.query().whereIn('id', rtIds)
        const channexMap = new Map<number, string>()
        for (const rt of roomTypes) {
          if (rt.channexRoomTypeId) channexMap.set(rt.id, rt.channexRoomTypeId)
        }
        if (channexMap.size === 0) {
          return
        }

        const rrService = new ReservationRoomService()
        const daily = await rrService.getDailyAvailableRoomCountsByRoomType(
          reservation.hotelId,
          Array.from(channexMap.keys()),
          (arrival as DateTime).toJSDate(),
          (departure as DateTime).toJSDate()
        )

        const startDay = (arrival as DateTime).startOf('day')
        const endDay = (departure as DateTime).startOf('day')
        const values: any[] = []
        for (const rtId of channexMap.keys()) {
          let segStart = startDay
          let current = daily[startDay.toISODate()!]?.[rtId] ?? 0
          let cursor = startDay.plus({ days: 1 })
          while (cursor <= endDay) {
            const key = cursor.toISODate()!
            const val = daily[key]?.[rtId] ?? 0
            if (val !== current) {
              values.push({
                room_type_id: channexMap.get(rtId)!,
                property_id: hotel.channexPropertyId,
                date_from: segStart.toISODate()!,
                date_to: cursor.minus({ days: 1 }).toISODate()!,
                availability: current,
              })
              segStart = cursor
              current = val
            }
            cursor = cursor.plus({ days: 1 })
          }
          values.push({
            room_type_id: channexMap.get(rtId)!,
            property_id: hotel.channexPropertyId,
            date_from: segStart.toISODate()!,
            date_to: endDay.toISODate()!,
            availability: current,
          })
        }

        const channexService = new ChannexService()
        await channexService.updateAvailability(hotel.channexPropertyId, { values })
      } catch (err) {
        try {
          await LoggerService.logActivity({
            action: 'ERROR',
            resourceType: 'ChannexAvailability',
            resourceId: reservation.id,
            description: 'notifyAvailabilityOnCreate failed',
            details: { error: (err as any)?.message, stack: (err as any)?.stack },
            hotelId: reservation.hotelId,
          })
        } catch {}
      }
    }, 0)
  }

  public static notifyAvailabilityOnUpdate(reservation: Reservation) {
    setTimeout(async () => {
      try {
        const hotel = await Hotel.find(reservation.hotelId)
        if (!hotel || !hotel.channexPropertyId) {
          return
        }

        await reservation.load('reservationRooms')
        const rtIdsSet = new Set<number>()
        for (const rr of reservation.reservationRooms || []) {
          const rid = (rr as any).roomTypeId || (rr as any).room_type_id
          if (rid) rtIdsSet.add(rid)
        }
        if (rtIdsSet.size === 0) {
          return
        }

        const prevArrivalRaw = (reservation as any).$original?.arrivedDate
        const prevDepartureRaw = (reservation as any).$original?.departDate
        const currArrivalRaw = reservation.arrivedDate
        const currDepartureRaw = reservation.departDate
        if (!currArrivalRaw || !currDepartureRaw) {
          return
        }

        const toDt = (v: any) => {
          if (!v) return undefined
          if (typeof v === 'string') return DateTime.fromISO(v)
          if ((v as any).toISO) return v as DateTime
          if ((v as any).toJSDate) return DateTime.fromJSDate((v as any).toJSDate())
          if (v instanceof Date) return DateTime.fromJSDate(v)
          return undefined
        }

        const prevArrival = toDt(prevArrivalRaw)
        const prevDeparture = toDt(prevDepartureRaw)
        const currArrival = toDt(currArrivalRaw)!
        const currDeparture = toDt(currDepartureRaw)!

        const unionStart = prevArrival ? (prevArrival < currArrival ? prevArrival : currArrival) : currArrival
        const unionEnd = prevDeparture ? (prevDeparture > currDeparture ? prevDeparture : currDeparture) : currDeparture

        const rtIds = Array.from(rtIdsSet)
        const roomTypes = await RoomType.query().whereIn('id', rtIds)
        const channexMap = new Map<number, string>()
        for (const rt of roomTypes) {
          if (rt.channexRoomTypeId) channexMap.set(rt.id, rt.channexRoomTypeId)
        }
        if (channexMap.size === 0) {
          return
        }

        const rrService = new ReservationRoomService()
        const daily = await rrService.getDailyAvailableRoomCountsByRoomType(
          reservation.hotelId,
          Array.from(channexMap.keys()),
          unionStart.toJSDate(),
          unionEnd.toJSDate()
        )

        const startDay = unionStart.startOf('day')
        const endDay = unionEnd.startOf('day')
        const values: any[] = []
        for (const rtId of channexMap.keys()) {
          let segStart = startDay
          let current = daily[startDay.toISODate()!]?.[rtId] ?? 0
          let cursor = startDay.plus({ days: 1 })
          while (cursor <= endDay) {
            const key = cursor.toISODate()!
            const val = daily[key]?.[rtId] ?? 0
            if (val !== current) {
              values.push({
                room_type_id: channexMap.get(rtId)!,
                property_id: hotel.channexPropertyId,
                date_from: segStart.toISODate()!,
                date_to: cursor.minus({ days: 1 }).toISODate()!,
                availability: current,
              })
              segStart = cursor
              current = val
            }
            cursor = cursor.plus({ days: 1 })
          }
          values.push({
            room_type_id: channexMap.get(rtId)!,
            property_id: hotel.channexPropertyId,
            date_from: segStart.toISODate()!,
            date_to: endDay.toISODate()!,
            availability: current,
          })
        }

        const channexService = new ChannexService()
        await channexService.updateAvailability(hotel.channexPropertyId, { values })
      } catch (err) {
        try {
          await LoggerService.logActivity({
            action: 'ERROR',
            resourceType: 'ChannexAvailability',
            resourceId: reservation.id,
            description: 'notifyAvailabilityOnUpdate failed',
            details: { error: (err as any)?.message, stack: (err as any)?.stack },
            hotelId: reservation.hotelId,
          })
        } catch {}
      }
    }, 0)
  }
}