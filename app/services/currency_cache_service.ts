import env from '#start/env'
import Currency from '#models/currency'

/**
 * CurrencyCacheService caches the default currency per hotel in-memory.
 * - Key: hotelId (number)
 * - TTL: Configurable via env CURRENCY_CACHE_TTL_SECONDS (default 7 days)
 * - Invalidation: Call invalidateHotelCurrency on create/update events
 */
export default class CurrencyCacheService {
  // Simple in-memory cache: hotelId -> { payload, expiresAt }
  private static cache: Map<number, { payload: any; expiresAt: number }> = new Map()

  static keyForHotel(hotelId: number) {
    return `currency:default:hotel:${hotelId}`
  }

  static ttlSeconds(): number {
    const ttl = env.get('CURRENCY_CACHE_TTL_SECONDS', 60 * 60 * 24 * 7) // 7 days default
    return Number(ttl)
  }

  /**
   * Get cached default currency payload for a hotel (JSON object) if present.
   */
  static async getCachedHotelCurrency(hotelId: number): Promise<any | null> {
    const record = this.cache.get(hotelId)
    const now = Date.now()
    if (!record) return null
    if (record.expiresAt <= now) {
      this.cache.delete(hotelId)
      return null
    }
    return record.payload
  }

  /**
   * Resolve and cache the default currency for a hotel. Returns JSON payload.
   */
  static async getHotelDefaultCurrency(hotelId: number): Promise<any | null> {
    const existing = await this.getCachedHotelCurrency(hotelId)
    if (existing) return existing

    const currency = await Currency.query()
      .where('hotel_id', hotelId)
      .where('is_default', true)
      .first()

    if (!currency) return null
    const payload = typeof (currency as any).toJSON === 'function' ? (currency as any).toJSON() : (currency as any)

    await this.setHotelCurrency(hotelId, payload)
    return payload
  }

  /**
   * Set cached default currency JSON with TTL.
   */
  static async setHotelCurrency(hotelId: number, payload: any) {
    const ttl = this.ttlSeconds()
    const expiresAt = Date.now() + ttl * 1000
    this.cache.set(hotelId, { payload, expiresAt })
  }

  /**
   * Invalidate cached default currency for a hotel.
   */
  static async invalidateHotelCurrency(hotelId: number) {
    this.cache.delete(hotelId)
  }
}