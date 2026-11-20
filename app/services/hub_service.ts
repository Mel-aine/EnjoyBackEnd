import axios, { AxiosInstance } from 'axios'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import RoomRate from '#models/room_rate'
import ReservationRoomService from '#services/reservation_room_service'

/**
 * Controls the Enjoy Connectivity Hub from the PMS side (plan-admin-hub.md,
 * choice A): the hub calls `/api/hub-control/*` here, and this service calls
 * back the hub's PMS API with the key the hub handed us on link.
 *
 * Mapping rule: everything is matched by `external_id`, so nothing has to be
 * stored on the enjoy side besides the link itself (hotels.hub_*).
 */

/** Enjoy room type/s -> hub room type external id. */
export function roomTypeExternalId(roomTypeId: number | string): string {
  return `enjoy-rt-${roomTypeId}`
}

/** Enjoy room type -> the single hub rate plan pushed for it. */
export function ratePlanExternalId(roomTypeId: number | string): string {
  return `enjoy-rp-${roomTypeId}`
}

export type HubFailure = Error & { code?: string; status?: number; details?: unknown }

function hubFailure(code: string, message: string, details?: unknown): HubFailure {
  const error: HubFailure = new Error(message)
  error.code = code
  error.details = details
  return error
}

export function hubApiBaseUrl(): string {
  const base = env.get('HUB_API_URL') || 'http://127.0.0.1:58019/api/v1'
  return String(base).replace(/\/+$/, '')
}

/** Lucid serializes column names, but be tolerant to both spellings. */
function field(row: any, snake: string, camel: string) {
  return row?.[snake] ?? row?.[camel]
}

function isoOf(value: any): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  const parsed = DateTime.fromJSDate(value instanceof Date ? value : new Date(String(value)))
  return parsed.isValid ? parsed.toISODate() : String(value).slice(0, 10)
}

/**
 * Nightly price for one room type: a dated row wins, then the effective range,
 * then the most recent price known. Null when the room type has no rate at all.
 */
export function resolveNightlyRate(rows: RoomRate[], date: string): number | null {
  const priced = rows.filter((row) => Number(row.baseRate) > 0)

  const exact = priced.find((row) => isoOf((row as any).rateDate) === date)
  if (exact) return Number(exact.baseRate)

  const ranged = priced.filter((row) => {
    const from = isoOf((row as any).effectiveFrom)
    const to = isoOf((row as any).effectiveTo)
    return Boolean(from && to && from <= date && date <= to)
  })
  if (ranged.length) return Number(ranged[ranged.length - 1].baseRate)

  const ordered = [...priced].sort((a, b) =>
    String(isoOf((a as any).effectiveFrom) ?? '').localeCompare(
      String(isoOf((b as any).effectiveFrom) ?? '')
    )
  )
  const last = ordered[ordered.length - 1]
  return last ? Number(last.baseRate) : null
}

export type CatalogReport = {
  room_types_created: number
  room_types_reused: number
  rate_plans_created: number
  rate_plans_reused: number
  links: { room_types: number; rate_plans: number }
}

export type AriReport = {
  job_id: string
  days: number
  status: 'completed' | 'partial' | 'failed'
  availability: { sent: number; updated: number }
  rates: { sent: number; updated: number }
  errors: string[]
}

export default class HubService {
  private client: AxiosInstance

  constructor(private hotel: Hotel) {
    if (!hotel.hubPropertyId || !hotel.hubApiKey) {
      throw hubFailure('not_linked', 'Hotel is not linked to the hub')
    }

    this.client = axios.create({
      baseURL: hubApiBaseUrl(),
      headers: {
        'X-API-Key': hotel.hubApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // The hub database is remote and writes availability night by night.
      timeout: 180000,
    })
  }

  private get propertyId(): number {
    return Number(this.hotel.hubPropertyId)
  }

  /** True when the hub accepts our key (used by the status card). */
  async isKeyValid(): Promise<boolean | null> {
    try {
      await this.client.get('/properties')
      return true
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) return false
      return null
    }
  }

  async catalog(): Promise<{ roomTypes: any[]; ratePlans: any[] }> {
    try {
      const [roomTypes, ratePlans] = await Promise.all([
        this.client.get('/room-types'),
        this.client.get('/rate-plans'),
      ])
      return {
        roomTypes: (roomTypes.data?.data ?? []) as any[],
        ratePlans: (ratePlans.data?.data ?? []) as any[],
      }
    } catch (error: any) {
      throw hubFailure(
        'hub_unreachable',
        error?.response?.data?.error?.message || error?.message || 'Hub unreachable',
        error?.response?.data ?? null
      )
    }
  }

  /** Hub totals for the status card. */
  async catalogCounts() {
    const roomTypes = await RoomType.query().where('hotel_id', this.hotel.id)
    const { roomTypes: hubRoomTypes, ratePlans: hubRatePlans } = await this.catalog()

    const hubRoomTypeIds = new Set(
      hubRoomTypes.map((row) => String(field(row, 'external_id', 'externalId') ?? ''))
    )
    const hubRatePlanIds = new Set(
      hubRatePlans.map((row) => String(field(row, 'external_id', 'externalId') ?? ''))
    )

    return {
      room_types: {
        linked: roomTypes.filter((rt) => hubRoomTypeIds.has(roomTypeExternalId(rt.id))).length,
        total: roomTypes.length,
      },
      rate_plans: {
        linked: roomTypes.filter((rt) => hubRatePlanIds.has(ratePlanExternalId(rt.id))).length,
        total: roomTypes.length,
      },
    }
  }

  private async post(path: string, body: any): Promise<any> {
    try {
      const response = await this.client.post(path, body)
      return response.data?.data ?? response.data
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Hub rejected the request'
      throw hubFailure('hub_rejected', String(message), error?.response?.data ?? null)
    }
  }

  private async put(path: string, body: any): Promise<any> {
    try {
      const response = await this.client.put(path, body)
      return response.data ?? {}
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Hub rejected the request'
      throw hubFailure('hub_rejected', String(message), error?.response?.data ?? null)
    }
  }

  /** Active rooms of a room type, floored at 1 because the hub requires one. */
  private async roomCount(roomType: RoomType): Promise<number> {
    // Raw query builder: the Room model adds an `order by sort_key` that
    // Postgres rejects next to an aggregate.
    const rows = await db
      .from('rooms')
      .where('room_type_id', roomType.id)
      .where('is_deleted', false)
      .count('* as total')
    return Math.max(1, Number((rows[0] as any)?.total ?? 0))
  }

  private async nightlyRows(): Promise<RoomRate[]> {
    return RoomRate.query().where('hotel_id', this.hotel.id)
  }

  private defaultRateFor(rows: RoomRate[], roomTypeId: number): number | null {
    const own = rows.filter((row) => Number(row.roomTypeId) === Number(roomTypeId))
    const priced = own.filter((row) => Number(row.baseRate) > 0)
    if (!priced.length) return null
    return Number(priced[priced.length - 1].baseRate)
  }

  /**
   * Creates the missing hub room types and, for each of them, one hub rate plan
   * (`enjoy-rp-<roomTypeId>`): enjoy has no rate plans of its own, its prices
   * live on `room_rates`, so a single "Standard" plan carries them.
   */
  async syncCatalog(): Promise<CatalogReport> {
    const report: CatalogReport = {
      room_types_created: 0,
      room_types_reused: 0,
      rate_plans_created: 0,
      rate_plans_reused: 0,
      links: { room_types: 0, rate_plans: 0 },
    }

    const existing = await this.catalog()
    const roomTypesByExternal = new Map<string, any>(
      existing.roomTypes.map((row) => [String(field(row, 'external_id', 'externalId') ?? ''), row])
    )
    const ratePlansByExternal = new Map<string, any>(
      existing.ratePlans.map((row) => [String(field(row, 'external_id', 'externalId') ?? ''), row])
    )

    const roomTypes = await RoomType.query().where('hotel_id', this.hotel.id)
    const rates = await this.nightlyRows()

    for (const roomType of roomTypes) {
      const externalId = roomTypeExternalId(roomType.id)
      let hubRoomTypeId: number | null = null

      const known = roomTypesByExternal.get(externalId)
      if (known) {
        hubRoomTypeId = Number(known.id)
        report.room_types_reused++
      } else {
        const created = await this.post('/room-types', {
          property_id: this.propertyId,
          external_id: externalId,
          name: roomType.roomTypeName || `Room type ${roomType.id}`,
          count_of_rooms: await this.roomCount(roomType),
          occ_adults: Math.max(1, Number(roomType.maxAdult) || Number(roomType.baseAdult) || 1),
          occ_children: Number(roomType.maxChild) || 0,
          occ_infants: 0,
          default_occupancy: Math.max(
            1,
            (Number(roomType.baseAdult) || 0) + (Number(roomType.baseChild) || 0)
          ),
        })
        hubRoomTypeId = Number(created?.id)
        report.room_types_created++
      }

      if (!hubRoomTypeId) continue
      report.links.room_types++

      const planExternalId = ratePlanExternalId(roomType.id)
      if (ratePlansByExternal.has(planExternalId)) {
        report.rate_plans_reused++
      } else {
        const defaultRate = this.defaultRateFor(rates, roomType.id)
        const options: Record<string, any> = { currency: this.hotel.currencyCode || 'XAF' }
        if (defaultRate) options.default_rate = defaultRate

        await this.post('/rate-plans', {
          room_type_id: hubRoomTypeId,
          external_id: planExternalId,
          name: 'Standard',
          sell_mode: 'per_room',
          options,
        })
        report.rate_plans_created++
      }
      report.links.rate_plans++
    }

    return report
  }

  /**
   * Pushes absolute availability (rooms free per night) and nightly prices for
   * the next `days` nights. Chunked because a year of several room types is a
   * lot of items for one request.
   */
  async pushAri(days: number): Promise<AriReport> {
    const existing = await this.catalog()
    const hubRoomTypeIds = new Map<string, number>(
      existing.roomTypes.map((row) => [
        String(field(row, 'external_id', 'externalId') ?? ''),
        Number(row.id),
      ])
    )
    const hubRatePlanIds = new Map<string, number>(
      existing.ratePlans.map((row) => [
        String(field(row, 'external_id', 'externalId') ?? ''),
        Number(row.id),
      ])
    )

    const roomTypes = await RoomType.query().where('hotel_id', this.hotel.id)
    const linked: { roomType: RoomType; hubRoomTypeId: number; hubRatePlanId: number | null }[] = []
    for (const roomType of roomTypes) {
      const hubRoomTypeId = hubRoomTypeIds.get(roomTypeExternalId(roomType.id))
      if (!hubRoomTypeId) continue
      linked.push({
        roomType,
        hubRoomTypeId,
        hubRatePlanId: hubRatePlanIds.get(ratePlanExternalId(roomType.id)) ?? null,
      })
    }

    if (!linked.length) {
      throw hubFailure(
        'catalog_not_synced',
        'No room type is linked in the hub yet: import the catalog first'
      )
    }

    const start = DateTime.now().startOf('day')
    const end = start.plus({ days: Math.max(1, days) - 1 })
    const service = new ReservationRoomService()
    const daily = await service.getDailyAvailableRoomCountsByRoomType(
      this.hotel.id,
      linked.map((entry) => entry.roomType.id),
      start.toJSDate(),
      end.toJSDate()
    )

    const rates = await this.nightlyRows()
    const availabilityItems: any[] = []
    const rateItems: any[] = []

    for (const entry of linked) {
      const ownRates = rates.filter(
        (row) => Number(row.roomTypeId) === Number(entry.roomType.id)
      )

      let cursor = start
      while (cursor <= end) {
        const date = cursor.toISODate()!
        const available = daily[date]?.[entry.roomType.id]
        if (available !== undefined && available !== null) {
          availabilityItems.push({
            room_type_id: entry.hubRoomTypeId,
            date,
            total: Math.max(0, Number(available)),
          })
        }
        if (entry.hubRatePlanId) {
          const rate = resolveNightlyRate(ownRates, date)
          if (rate !== null && rate > 0) {
            rateItems.push({ rate_plan_id: entry.hubRatePlanId, date, rate })
          }
        }
        cursor = cursor.plus({ days: 1 })
      }
    }

    const errors: string[] = []
    let availabilityUpdated = 0
    let ratesUpdated = 0

    for (const chunk of chunked(availabilityItems, 50)) {
      try {
        const result = await this.put('/availability', { items: chunk })
        availabilityUpdated += Number(result?.updated ?? 0)
      } catch (error: any) {
        errors.push(`availability: ${error?.message ?? 'failed'}`)
      }
    }

    for (const chunk of chunked(rateItems, 100)) {
      try {
        const result = await this.put('/rates', { items: chunk })
        ratesUpdated += Number(result?.updated ?? 0)
      } catch (error: any) {
        errors.push(`rates: ${error?.message ?? 'failed'}`)
      }
    }

    this.hotel.hubLastPushAt = DateTime.now()
    await this.hotel.save()

    return {
      job_id: `enjoy-${DateTime.now().toFormat('yyyyMMdd-HHmmss')}`,
      days: Math.max(1, days),
      status: errors.length === 0 ? 'completed' : availabilityUpdated + ratesUpdated > 0 ? 'partial' : 'failed',
      availability: { sent: availabilityItems.length, updated: availabilityUpdated },
      rates: { sent: rateItems.length, updated: ratesUpdated },
      errors,
    }
  }

  /** Unlinking keeps the mapping and stops the pushes. */
  async unlink(): Promise<void> {
    this.hotel.hubPropertyId = null
    this.hotel.hubApiKey = null
    this.hotel.hubWebhookUrl = null
    this.hotel.hubLinkedAt = null
    await this.hotel.save()
  }
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
