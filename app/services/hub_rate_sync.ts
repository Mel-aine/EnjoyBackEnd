import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import Hotel from '#models/hotel'
import RoomRate from '#models/room_rate'
import LoggerService from '#services/logger_service'
import HubService, { isHubEnabled, type HubRateItem } from '#services/hub_service'

/**
 * Prices and restrictions towards the Hub OTA (flux D).
 *
 * enjoy keeps no per-date price: a room rate has one base rate and its
 * restrictions; per-date prices are typed in the ARI screens and sent to
 * Channex as they are. The hub gets exactly the same values:
 *
 * - `mirrorChannexRestrictions`: called right after each successful Channex
 *   restrictions push (same values, Channex rate plan ids mapped to hub ids).
 * - `pushBaseRates`: base rate and restrictions of each mapped room rate over
 *   a date range (initial seed, `node ace hub:push-rates`).
 *
 * Fire-and-forget: a hub error never changes the Channex response.
 */

const DAY_CODES = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']
/** Upper bound of one mirrored range. */
const MAX_DAYS = 730

function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return undefined
}

function toInt(value: unknown): number | null | undefined {
  if (value === undefined || value === '') return undefined
  if (value === null) return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : undefined
}

/** Channex rate: decimal string ("35000.00") or a number. XAF has no minor unit. */
function toRate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function eachDate(
  from: string,
  to: string,
  days: string[] | undefined,
  fn: (date: string) => void
) {
  const start = DateTime.fromISO(from).startOf('day')
  const end = DateTime.fromISO(to || from).startOf('day')
  if (!start.isValid || !end.isValid) return
  const allowed = days?.length ? new Set(days.map((d) => String(d).toLowerCase())) : null
  let day = start
  let guard = 0
  while (day <= end && guard < MAX_DAYS) {
    if (!allowed || allowed.has(DAY_CODES[day.weekday - 1])) fn(day.toISODate()!)
    day = day.plus({ days: 1 })
    guard++
  }
}

/** Channex restriction value → hub fields (only the fields that were sent). */
export function hubValuesFromChannex(value: any): Omit<HubRateItem, 'rate_plan_id' | 'date'> {
  const out: Omit<HubRateItem, 'rate_plan_id' | 'date'> = {}
  const rate = toRate(value?.rate)
  if (rate !== undefined) out.rate = rate
  const stopSell = toBool(value?.stop_sell)
  if (stopSell !== undefined) out.stop_sell = stopSell
  const cta = toBool(value?.closed_to_arrival)
  if (cta !== undefined) out.closed_to_arrival = cta
  const ctd = toBool(value?.closed_to_departure)
  if (ctd !== undefined) out.closed_to_departure = ctd
  // Channex `min_stay` sets both kinds of minimum stay.
  const minStay = toInt(value?.min_stay)
  const msa = toInt(value?.min_stay_arrival)
  const mst = toInt(value?.min_stay_through)
  if (msa !== undefined) out.min_stay_arrival = msa
  else if (minStay !== undefined) out.min_stay_arrival = minStay
  if (mst !== undefined) out.min_stay_through = mst
  else if (minStay !== undefined) out.min_stay_through = minStay
  const maxStay = toInt(value?.max_stay)
  if (maxStay !== undefined) out.max_stay = maxStay
  return out
}

/** Expands Channex restriction values into per-date hub items. */
export function expandChannexValues(
  values: any[],
  hubPlanByChannexId: Map<string, number>
): { items: HubRateItem[]; unmapped: string[] } {
  const items: HubRateItem[] = []
  const unmapped = new Set<string>()
  for (const value of values ?? []) {
    const channexId = String(value?.rate_plan_id ?? '')
    const hubId = hubPlanByChannexId.get(channexId)
    if (!hubId) {
      if (channexId) unmapped.add(channexId)
      continue
    }
    const fields = hubValuesFromChannex(value)
    if (!Object.keys(fields).length) continue
    const from = value?.date ?? value?.date_from
    const to = value?.date ?? value?.date_to ?? from
    if (!from) continue
    eachDate(
      String(from),
      String(to),
      Array.isArray(value?.days) ? value.days : undefined,
      (date) => items.push({ rate_plan_id: hubId, date, ...fields })
    )
  }
  return { items, unmapped: [...unmapped] }
}

export default class HubRateSync {
  /**
   * Mirrors to the hub what was just sent to Channex. Never throws, never
   * waits: call it after the Channex call succeeded.
   */
  static mirrorChannexRestrictions(channexPropertyId: string | null | undefined, values: any[]) {
    try {
      if (!isHubEnabled() || !channexPropertyId || !Array.isArray(values) || !values.length) return
      setImmediate(() => {
        mirror(String(channexPropertyId), values).catch((err) =>
          logger.error({ err }, '[Hub] rate mirror failed')
        )
      })
    } catch {}
  }

  /**
   * Sends the base rate and restrictions of each mapped room rate from `from`
   * to `to`. Overwrites per-date prices on the hub for those dates.
   */
  static async pushBaseRates(
    hotelId: number,
    from: DateTime,
    to: DateTime,
    roomRateIds?: number[]
  ) {
    const hotel = await Hotel.find(hotelId)
    const client = HubService.forHotel(hotel)
    if (!hotel || !client) return { updated: 0, skipped: true }

    const query = RoomRate.query().where('hotel_id', hotelId).whereNotNull('hub_rate_plan_id')
    if (roomRateIds?.length) query.whereIn('id', roomRateIds)
    const rates = await query
    if (!rates.length) return { updated: 0, skipped: true }

    const items: HubRateItem[] = []
    for (const rr of rates) {
      const maxStay = Number(rr.maximumNights) > 0 ? Number(rr.maximumNights) : null
      const minStay = Number(rr.minimumNights) > 0 ? Number(rr.minimumNights) : null
      eachDate(from.toISODate()!, to.toISODate()!, undefined, (date) =>
        items.push({
          rate_plan_id: rr.hubRatePlanId!,
          date,
          rate: Number(rr.baseRate) || 0,
          stop_sell: !!rr.stopSell,
          closed_to_arrival: !!rr.closedToArrival,
          closed_to_departure: !!rr.closedToDeparture,
          min_stay_arrival: minStay,
          min_stay_through: minStay,
          max_stay: maxStay,
        })
      )
    }
    const res = await client.putRates(items)
    return { updated: res.updated, skipped: false }
  }
}

async function mirror(channexPropertyId: string, values: any[]) {
  const hotel = await Hotel.query().where('channex_property_id', channexPropertyId).first()
  const client = HubService.forHotel(hotel)
  if (!hotel || !client) return

  const channexIds = [...new Set(values.map((v) => String(v?.rate_plan_id ?? '')).filter(Boolean))]
  if (!channexIds.length) return
  const rates = await RoomRate.query()
    .where('hotel_id', hotel.id)
    .whereIn('channex_rate_id', channexIds)
    .whereNotNull('hub_rate_plan_id')
    .select(['channex_rate_id', 'hub_rate_plan_id'])
  const map = new Map<string, number>()
  for (const rr of rates) map.set(String(rr.channexRateId), rr.hubRatePlanId!)

  const { items } = expandChannexValues(values, map)
  if (!items.length) return

  try {
    await client.putRates(items)
  } catch (err) {
    logger.error({ err, hotelId: hotel.id }, '[Hub] rate push failed')
    await LoggerService.logActivity({
      action: 'ERROR',
      resourceType: 'HubRates',
      resourceId: hotel.id,
      description: `Prix non transmis au hub OTA : ${(err as any)?.code ?? (err as any)?.message}`,
      details: { status: (err as any)?.status, code: (err as any)?.code, items: items.length },
      hotelId: hotel.id,
    }).catch(() => {})
  }
}
