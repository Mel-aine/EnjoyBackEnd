import { DateTime } from 'luxon'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import Hotel from '#models/hotel'
import Room from '#models/room'
import RoomType from '#models/room_type'
import ReservationRoom from '#models/reservation_room'
import ReservationRoomService from '#services/reservation_room_service'
import LoggerService from '#services/logger_service'
import { LockNamespace, withLock } from '#services/advisory_lock'
import HubService, {
  isHubEnabled,
  type HubAvailabilityItem,
  type HubOversold,
} from '#services/hub_service'

/**
 * Pushes enjoy availability to the Hub OTA, next to the existing Channex push.
 *
 * - Model hooks only call `enqueue*`: it records what changed and returns at
 *   once. It never throws and never touches the caller's transaction.
 * - Changes are grouped per hotel and sent after a short delay, once the
 *   caller's transaction has committed, so the hub gets committed values.
 * - Values are absolute (`total`), recomputed from the database at send time:
 *   a late or replayed push cannot corrupt the hub.
 * - A nightly full resync (start/scheduler.ts) catches anything missed
 *   (bulk SQL updates that bypass model hooks, process restart…).
 *
 * `total` excludes reservations that come from the hub itself: the hub
 * already counts them in its `sold`.
 */

type Scope = {
  roomTypeIds: Set<number>
  roomIds: Set<number>
  reservationIds: Set<number>
  from: DateTime | null
  to: DateTime | null
}

type DateLike = DateTime | Date | string | null | undefined

/** Upper bound of a single push, whatever the dates of the change. */
const MAX_RANGE_DAYS = 730

const pending = new Map<number, Scope>()
const timers = new Map<number, NodeJS.Timeout>()
const running = new Set<number>()

function toDateTime(value: DateLike): DateTime | null {
  if (!value) return null
  if (DateTime.isDateTime(value)) return value.isValid ? value.startOf('day') : null
  if (value instanceof Date) return DateTime.fromJSDate(value).startOf('day')
  const dt = DateTime.fromISO(String(value))
  return dt.isValid ? dt.startOf('day') : null
}

function debounceMs(): number {
  return env.get('HUB_PUSH_DEBOUNCE_MS', 1500) ?? 1500
}

function scopeFor(hotelId: number): Scope {
  let scope = pending.get(hotelId)
  if (!scope) {
    scope = {
      roomTypeIds: new Set(),
      roomIds: new Set(),
      reservationIds: new Set(),
      from: null,
      to: null,
    }
    pending.set(hotelId, scope)
  }
  return scope
}

function widen(scope: Scope, dates: DateLike[]) {
  for (const raw of dates) {
    const d = toDateTime(raw)
    if (!d) continue
    if (!scope.from || d < scope.from) scope.from = d
    if (!scope.to || d > scope.to) scope.to = d
  }
}

function schedule(hotelId: number) {
  if (timers.has(hotelId)) return
  const timer = setTimeout(() => {
    timers.delete(hotelId)
    void flush(hotelId)
  }, debounceMs())
  timer.unref?.()
  timers.set(hotelId, timer)
}

/** Runs `fn` after the transaction commits, or right away without one. */
function afterCommit(trx: any, fn: () => void) {
  if (trx && !trx.isCompleted && typeof trx.after === 'function') {
    trx.after('commit', fn)
    return
  }
  fn()
}

export type AvailabilityChange = {
  hotelId: number
  roomTypeIds?: Array<number | null | undefined>
  roomIds?: Array<number | null | undefined>
  reservationId?: number | null
  dates?: DateLike[]
  trx?: any
}

export default class HubAvailabilitySync {
  /** Records a change. Safe to call from any model hook: never throws. */
  static enqueue(change: AvailabilityChange) {
    try {
      if (!isHubEnabled() || !change.hotelId) return
      afterCommit(change.trx, () => {
        try {
          const scope = scopeFor(change.hotelId)
          for (const id of change.roomTypeIds ?? []) if (id) scope.roomTypeIds.add(Number(id))
          for (const id of change.roomIds ?? []) if (id) scope.roomIds.add(Number(id))
          if (change.reservationId) scope.reservationIds.add(Number(change.reservationId))
          widen(scope, change.dates ?? [])
          schedule(change.hotelId)
        } catch (err) {
          logger.warn({ err }, '[Hub] enqueue failed')
        }
      })
    } catch (err) {
      logger.warn({ err }, '[Hub] enqueue failed')
    }
  }

  /** Sends what is pending for a hotel. Errors are logged, never thrown. */
  static async flush(hotelId: number) {
    return flush(hotelId)
  }

  /**
   * Full push for one hotel over `days` days from today (initial sync and
   * nightly resync). Throws so that the command can report the error.
   */
  static async pushRange(hotelId: number, from: DateTime, to: DateTime, roomTypeIds?: number[]) {
    // One push at a time per hotel, across instances: values are computed
    // inside the lock, so the last push sent always carries the newest values.
    return withLock(LockNamespace.hubAvailabilityPush, hotelId, () =>
      pushRangeUnlocked(hotelId, from, to, roomTypeIds)
    )
  }

  /**
   * Full resync of every hotel linked to the hub, from today for `days` days.
   * One failing hotel does not stop the others.
   */
  static async resyncAll(days = env.get('HUB_RESYNC_DAYS', 365) ?? 365) {
    if (!isHubEnabled()) return []
    const hotels = await Hotel.query().whereNotNull('hub_api_key').select(['id'])
    const from = DateTime.now().startOf('day')
    const to = from.plus({ days: Math.max(1, days) - 1 })
    const results: Array<{ hotelId: number; updated?: number; oversold?: number; error?: string }> =
      []
    for (const { id } of hotels) {
      try {
        const res = await HubAvailabilitySync.pushRange(id, from, to)
        results.push({ hotelId: id, updated: res.updated, oversold: res.oversold.length })
      } catch (err) {
        logger.error({ err, hotelId: id }, '[Hub] nightly resync failed')
        results.push({ hotelId: id, error: (err as any)?.message ?? String(err) })
      }
    }
    return results
  }
}

async function pushRangeUnlocked(
  hotelId: number,
  from: DateTime,
  to: DateTime,
  roomTypeIds?: number[]
) {
  {
    const hotel = await Hotel.find(hotelId)
    const client = HubService.forHotel(hotel)
    if (!hotel || !client) return { updated: 0, oversold: [] as HubOversold[], skipped: true }

    const query = RoomType.query().where('hotel_id', hotelId).whereNotNull('hub_room_type_id')
    if (roomTypeIds?.length) query.whereIn('id', roomTypeIds)
    const roomTypes = await query
    if (!roomTypes.length) return { updated: 0, oversold: [] as HubOversold[], skipped: true }

    const hubIdByLocal = new Map<number, number>()
    for (const rt of roomTypes) hubIdByLocal.set(rt.id, rt.hubRoomTypeId!)

    const items: HubAvailabilityItem[] = []
    // Compute by windows of 90 days to keep each query small.
    let windowStart = from.startOf('day')
    const end = to.startOf('day')
    const service = new ReservationRoomService()
    while (windowStart <= end) {
      const windowEnd = DateTime.min(windowStart.plus({ days: 89 }), end)
      const daily = await service.getDailyAvailableRoomCountsByRoomType(
        hotelId,
        Array.from(hubIdByLocal.keys()),
        windowStart.toJSDate(),
        windowEnd.toJSDate(),
        { excludeHubBookings: true }
      )
      let day = windowStart
      while (day <= windowEnd) {
        const key = day.toISODate()!
        for (const [localId, hubId] of hubIdByLocal) {
          items.push({
            room_type_id: hubId,
            date: key,
            total: Math.max(0, daily[key]?.[localId] ?? 0),
          })
        }
        day = day.plus({ days: 1 })
      }
      windowStart = windowEnd.plus({ days: 1 })
    }

    const result = await client.putAvailability(items)
    if (result.oversold.length) await reportOversold(hotel, result.oversold)
    return { ...result, skipped: false }
  }
}

async function flush(hotelId: number) {
  // One flush at a time per hotel; a change arriving meanwhile is rescheduled.
  if (running.has(hotelId)) {
    schedule(hotelId)
    return
  }
  const scope = pending.get(hotelId)
  if (!scope) return
  pending.delete(hotelId)
  running.add(hotelId)

  try {
    const roomTypeIds = new Set(scope.roomTypeIds)
    const dates: DateLike[] = [scope.from, scope.to]

    if (scope.reservationIds.size) {
      const rooms = await ReservationRoom.query()
        .whereIn('reservation_id', Array.from(scope.reservationIds))
        .select(['room_type_id', 'room_id', 'check_in_date', 'check_out_date'])
      for (const rr of rooms) {
        if (rr.roomTypeId) roomTypeIds.add(rr.roomTypeId)
        if (rr.roomId) scope.roomIds.add(rr.roomId)
        dates.push(rr.checkInDate, rr.checkOutDate)
      }
    }

    // Availability is counted per room's type, which may differ from the
    // type booked: include the types of the rooms involved.
    if (scope.roomIds.size) {
      const rooms = await Room.query()
        .whereIn('id', Array.from(scope.roomIds))
        .select(['room_type_id'])
      for (const room of rooms) if (room.roomTypeId) roomTypeIds.add(room.roomTypeId)
    }

    const range: Scope = {
      roomTypeIds: new Set(),
      roomIds: new Set(),
      reservationIds: new Set(),
      from: null,
      to: null,
    }
    widen(range, dates)
    if (!range.from || !range.to || !roomTypeIds.size) return

    // Past nights cannot be sold; cap very long ranges.
    const today = DateTime.now().startOf('day')
    const from = DateTime.max(range.from, today)
    const to = DateTime.min(range.to, today.plus({ days: MAX_RANGE_DAYS }))
    if (to < from) return

    await HubAvailabilitySync.pushRange(hotelId, from, to, Array.from(roomTypeIds))
  } catch (err) {
    logger.error({ err, hotelId }, '[Hub] availability push failed')
    try {
      await LoggerService.logActivity({
        action: 'ERROR',
        resourceType: 'HubAvailability',
        resourceId: hotelId,
        description: 'Hub availability push failed',
        details: {
          error: (err as any)?.message,
          status: (err as any)?.status,
          code: (err as any)?.code,
        },
        hotelId,
      })
    } catch {}
  } finally {
    running.delete(hotelId)
  }
}

/**
 * The hub had already held or sold more rooms than enjoy now says are free
 * (flux F: Booking.com and a local OTA sold the last room at the same time).
 * Logged for the hotel; a dedicated alert screen comes with the booking intake.
 */
async function reportOversold(hotel: Hotel, oversold: HubOversold[]) {
  logger.warn({ hotelId: hotel.id, oversold }, '[Hub] oversold nights')
  try {
    await LoggerService.logActivity({
      action: 'WARNING',
      resourceType: 'HubOversold',
      resourceId: hotel.id,
      description: `Surréservation détectée par le hub OTA sur ${oversold.length} nuit(s)`,
      details: { oversold },
      hotelId: hotel.id,
    })
  } catch {}
}
