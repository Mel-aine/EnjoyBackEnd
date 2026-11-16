import env from '#start/env'
import type Hotel from '#models/hotel'

/**
 * HTTP client for the Hub OTA (connect-hub), PMS side.
 *
 * The hub sells enjoy rooms on local OTAs (KasaStay…). enjoy stays the only
 * owner of stock and prices: it pushes absolute values to the hub, reads the
 * hub booking feed and acknowledges each revision.
 *
 * Nothing here is called unless HUB_ENABLED=true and the hotel has a hub API
 * key, so hotels without the hub behave exactly as before.
 */

export type HubAvailabilityItem = { room_type_id: number; date: string; total: number }

export type HubOversold = {
  room_type_id: number
  date: string
  total: number
  held: number
  sold: number
}

export type HubRateItem = {
  rate_plan_id: number
  date: string
  rate?: number
  stop_sell?: boolean
  closed_to_arrival?: boolean
  closed_to_departure?: boolean
  min_stay_arrival?: number | null
  min_stay_through?: number | null
  max_stay?: number | null
}

export class HubError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string | null,
    public body: unknown
  ) {
    super(message)
  }
}

/** Items per request: keeps each hub transaction short. */
const CHUNK_SIZE = 400
const RETRIES = 2

export function isHubEnabled(): boolean {
  return env.get('HUB_ENABLED', false) === true && !!env.get('HUB_BASE_URL')
}

/** True when the hub is on and this hotel has been linked to it. */
export function isHotelOnHub(hotel: Pick<Hotel, 'hubApiKey'> | null | undefined): boolean {
  return isHubEnabled() && !!hotel?.hubApiKey
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default class HubService {
  private baseUrl: string
  private timeoutMs: number

  constructor(private apiKey: string) {
    this.baseUrl = String(env.get('HUB_BASE_URL', '')).replace(/\/+$/, '')
    this.timeoutMs = env.get('HUB_TIMEOUT_MS', 10000) ?? 10000
  }

  /** Client for a hotel, or null when the hub is off or the hotel is not linked. */
  static forHotel(hotel: Pick<Hotel, 'hubApiKey'> | null | undefined): HubService | null {
    if (!isHotelOnHub(hotel)) return null
    return new HubService(hotel!.hubApiKey!)
  }

  /**
   * Sends a request, retrying on network errors, 429 and 5xx. Throws HubError
   * on a final failure: callers decide whether to log or rethrow.
   */
  async request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            'X-Api-Key': this.apiKey,
            'Accept': 'application/json',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
        const text = await res.text()
        let json: any = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = text
        }

        if (res.ok) return json as T

        const code = json?.error?.code ?? null
        const error = new HubError(
          `Hub ${method} ${path} failed: ${res.status} ${code ?? ''}`.trim(),
          res.status,
          code,
          json
        )
        const retryable = res.status === 429 || res.status >= 500
        if (!retryable || attempt === RETRIES) throw error
        lastError = error
        const retryAfter = Number(res.headers.get('retry-after'))
        await sleep(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * (attempt + 1)
        )
      } catch (err) {
        if (err instanceof HubError) throw err
        // Network error or timeout.
        lastError = err
        if (attempt === RETRIES) {
          throw new HubError(
            `Hub ${method} ${path} unreachable: ${(err as any)?.message ?? err}`,
            0,
            'network_error',
            null
          )
        }
        await sleep(500 * (attempt + 1))
      } finally {
        clearTimeout(timer)
      }
    }
    throw lastError
  }

  /**
   * PUT /availability in absolute values. Returns the nights where the hub had
   * already held or sold more than `total` (to show to the hotel).
   */
  async putAvailability(
    items: HubAvailabilityItem[]
  ): Promise<{ updated: number; oversold: HubOversold[] }> {
    let updated = 0
    const oversold: HubOversold[] = []
    for (const part of chunk(items, CHUNK_SIZE)) {
      const res = await this.request<any>('PUT', '/availability', { items: part })
      updated += Number(res?.updated ?? 0)
      if (Array.isArray(res?.oversold)) oversold.push(...res.oversold)
    }
    return { updated, oversold }
  }

  async putRates(items: HubRateItem[]): Promise<{ updated: number }> {
    let updated = 0
    for (const part of chunk(items, CHUNK_SIZE)) {
      const res = await this.request<any>('PUT', '/rates', { items: part })
      updated += Number(res?.updated ?? 0)
    }
    return { updated }
  }

  async getBookingsFeed(cursor = 0, limit = 50): Promise<{ data: any[]; next_cursor?: number }> {
    return this.request('GET', `/bookings/feed?cursor=${cursor}&limit=${limit}`)
  }

  async ackBooking(bookingId: number, revisionSeq?: number | string | null) {
    return this.request(
      'POST',
      `/bookings/revisions/${bookingId}/ack`,
      revisionSeq !== undefined && revisionSeq !== null ? { revision_seq: Number(revisionSeq) } : {}
    )
  }

  async cancelBookingByProperty(bookingId: number, reason?: string) {
    return this.request('POST', `/pms/bookings/${bookingId}/cancel`, reason ? { reason } : {})
  }

  /** Hub room types of the key's tenant (`id`, `propertyId`, `externalId`, `name`…). */
  async listRoomTypes(): Promise<any[]> {
    const res = await this.request<any>('GET', '/room-types')
    return Array.isArray(res?.data) ? res.data : []
  }

  /** Hub rate plans of the key's tenant (`id`, `roomTypeId`, `externalId`, `parentRatePlanId`…). */
  async listRatePlans(): Promise<any[]> {
    const res = await this.request<any>('GET', '/rate-plans')
    return Array.isArray(res?.data) ? res.data : []
  }

  /** POST /properties (PMS key): creates a hub property for this enjoy hotel. */
  async createProperty(body: Record<string, unknown>): Promise<any> {
    const res = await this.request<any>('POST', '/properties', body)
    return res?.data
  }

  /** POST /room-types: `property_id`, `name`, `count_of_rooms`, `occ_adults`, `external_id`… */
  async createRoomType(body: Record<string, unknown>): Promise<any> {
    const res = await this.request<any>('POST', '/room-types', body)
    return res?.data
  }

  /** POST /rate-plans: `room_type_id`, `name`, `external_id`, `options`… */
  async createRatePlan(body: Record<string, unknown>): Promise<any> {
    const res = await this.request<any>('POST', '/rate-plans', body)
    return res?.data
  }

  async getWebhook() {
    return this.request('GET', '/pms/webhook')
  }

  async putWebhook(url: string | null, rotateSecret = false) {
    return this.request('PUT', '/pms/webhook', {
      url,
      ...(rotateSecret ? { rotate_secret: true } : {}),
    })
  }
}
