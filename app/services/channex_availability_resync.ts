import { DateTime } from 'luxon'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import RoomRate from '#models/room_rate'
import ReservationRoomService from '#services/reservation_room_service'
import LoggerService from '#services/logger_service'
import { ChannexService } from '#services/channex_service'
import { LockNamespace, withTryLock } from '#services/advisory_lock'

/**
 * Full availability push from enjoy to Channex (nightly, and on demand with
 * `node ace channex:push-availability`).
 *
 * The reservation hooks push availability on each change, but a push lost to a
 * network error was never sent again: Channex (hence Booking.com…) kept a wrong
 * value until the next change on those dates. This resync rewrites the truth
 * computed by enjoy, with the same function the hooks use.
 *
 * Off unless CHANNEX_AVAILABILITY_RESYNC=true: it overwrites every value of
 * the period in Channex, including availability edited by hand in the Channex
 * dashboard.
 */

export type ChannexResyncOutcome = {
  hotelId: number
  status: 'done' | 'skipped' | 'failed'
  ranges?: number
  message?: string
}

/** Values per Channex request. */
const CHUNK = 200

export function isChannexResyncEnabled(): boolean {
  return env.get('CHANNEX_AVAILABILITY_RESYNC', false) === true
}

export default class ChannexAvailabilityResync {
  /** One resync at a time per hotel, across instances (others skip it). */
  static async resyncHotel(hotelId: number, days = 365): Promise<ChannexResyncOutcome> {
    const run = await withTryLock(LockNamespace.channexAvailabilityResync, hotelId, () =>
      ChannexAvailabilityResync.resyncHotelUnlocked(hotelId, days)
    )
    return run.locked ? { hotelId, status: 'skipped', message: 'already running' } : run.value
  }

  /**
   * Sends each mapped room rate (base rate + restrictions) to Channex over
   * `days` days, with the same values as the ARI screen (bulkUpdateARI). Used
   * right after a migration so the new property has prices to sell.
   */
  static async pushBaseRates(hotelId: number, days = 365): Promise<ChannexResyncOutcome> {
    try {
      const hotel = await Hotel.find(hotelId)
      if (!hotel?.channexPropertyId) {
        return { hotelId, status: 'skipped', message: 'no Channex property' }
      }
      const rates = await RoomRate.query()
        .where('hotel_id', hotelId)
        .whereNotNull('channex_rate_id')
      if (!rates.length) return { hotelId, status: 'skipped', message: 'no mapped room rate' }

      const from = DateTime.now().startOf('day')
      const to = from.plus({ days: Math.max(1, days) - 1 })
      const values = rates.map((rr) => {
        const raw: Record<string, any> = {
          property_id: hotel.channexPropertyId,
          rate_plan_id: rr.channexRateId,
          date_from: from.toISODate(),
          date_to: to.toISODate(),
          rate: String(Number(rr.baseRate || 0).toFixed(2)),
          min_stay_arrival: rr.minimumNights || undefined,
          min_stay_through: rr.minimumNights || undefined,
          max_stay: rr.maximumNights || undefined,
          closed_to_arrival: rr.closedToArrival ? 1 : 0,
          closed_to_departure: rr.closedToDeparture ? 1 : 0,
          stop_sell: rr.stopSell ? 1 : 0,
        }
        return Object.fromEntries(
          Object.entries(raw).filter(([, v]) => v !== undefined && v !== null)
        )
      })

      await new ChannexService().updateRestrictions(hotel.channexPropertyId, {
        values: values as any,
      })
      return { hotelId, status: 'done', ranges: values.length }
    } catch (err) {
      const message = (err as any)?.message ?? String(err)
      logger.error({ err, hotelId }, '[ChannexResync] base rates push failed')
      return { hotelId, status: 'failed', message }
    }
  }

  static async resyncAll(days = env.get('CHANNEX_RESYNC_DAYS', 365) ?? 365) {
    const hotels = await Hotel.query().whereNotNull('channex_property_id').select(['id'])
    const results: ChannexResyncOutcome[] = []
    for (const { id } of hotels) {
      results.push(await ChannexAvailabilityResync.resyncHotel(id, days))
    }
    return results
  }

  static async resyncHotelUnlocked(hotelId: number, days = 365): Promise<ChannexResyncOutcome> {
    try {
      const hotel = await Hotel.find(hotelId)
      if (!hotel?.channexPropertyId)
        return { hotelId, status: 'skipped', message: 'no Channex property' }

      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .whereNotNull('channex_room_type_id')
        .select(['id', 'channex_room_type_id'])
      if (!roomTypes.length) return { hotelId, status: 'skipped', message: 'no mapped room type' }
      const channexIdByLocal = new Map(roomTypes.map((rt) => [rt.id, rt.channexRoomTypeId!]))

      const start = DateTime.now().startOf('day')
      const end = start.plus({ days: Math.max(1, days) - 1 })
      const service = new ReservationRoomService()

      // Consecutive nights with the same value become one range, as in the hooks.
      const values: Array<{
        room_type_id: string
        property_id: string
        date_from: string
        date_to: string
        availability: number
      }> = []
      const open = new Map<number, { from: string; to: string; value: number }>()
      const close = (localId: number) => {
        const seg = open.get(localId)
        if (!seg) return
        values.push({
          room_type_id: channexIdByLocal.get(localId)!,
          property_id: hotel.channexPropertyId!,
          date_from: seg.from,
          date_to: seg.to,
          availability: seg.value,
        })
        open.delete(localId)
      }

      let windowStart = start
      while (windowStart <= end) {
        const windowEnd = DateTime.min(windowStart.plus({ days: 89 }), end)
        const daily = await service.getDailyAvailableRoomCountsByRoomType(
          hotelId,
          Array.from(channexIdByLocal.keys()),
          windowStart.toJSDate(),
          windowEnd.toJSDate()
        )
        let day = windowStart
        while (day <= windowEnd) {
          const key = day.toISODate()!
          for (const localId of channexIdByLocal.keys()) {
            const value = Math.max(0, daily[key]?.[localId] ?? 0)
            const seg = open.get(localId)
            if (seg && seg.value === value) {
              seg.to = key
            } else {
              close(localId)
              open.set(localId, { from: key, to: key, value })
            }
          }
          day = day.plus({ days: 1 })
        }
        windowStart = windowEnd.plus({ days: 1 })
      }
      for (const localId of Array.from(open.keys())) close(localId)

      const channex = new ChannexService()
      for (let i = 0; i < values.length; i += CHUNK) {
        await channex.updateAvailability(hotel.channexPropertyId, {
          values: values.slice(i, i + CHUNK),
        })
      }
      return { hotelId, status: 'done', ranges: values.length }
    } catch (err) {
      const message = (err as any)?.message ?? String(err)
      logger.error({ err, hotelId }, '[ChannexResync] availability resync failed')
      try {
        await LoggerService.logActivity({
          action: 'ERROR',
          resourceType: 'ChannexAvailability',
          resourceId: hotelId,
          description: `Resynchronisation du stock Channex en échec : ${message}`,
          hotelId,
        })
      } catch {}
      return { hotelId, status: 'failed', message }
    }
  }
}
