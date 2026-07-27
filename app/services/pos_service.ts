import env from '#start/env'
import axios from 'axios'
import { DateTime } from 'luxon'

export default class PosService {
  private static getBaseUrl(): string {
    const base = env.get('POS_API_BASE_URL')
    if (!base || base.length === 0) {
      throw new Error('Missing POS_API_BASE_URL in environment')
    }
    // Ensure trailing slash
    return base.endsWith('/') ? base : `${base}/`
  }

  private static getTimeoutMs(): number {
    const t = env.get('POS_API_TIMEOUT_MS')
    return typeof t === 'number' && t > 0 ? t : 10000
  }

  private static buildHeaders(apiKey: string) {
    if (!apiKey || apiKey.length === 0) {
      throw new Error('Missing POS API key')
    }
    return {
      'x-api-key': apiKey,
      'accept': 'application/json',
    }
  }

  /**
   * Fetch night audit data from external POS (legacy)
   */
  static async getNightAudit(hotelId: number, auditDate: DateTime, apiKey: string): Promise<any | null> {
    try {
      const url = `${this.getBaseUrl()}pos_night_audit`
      const res = await axios.get(url, {
        params: {
          hotel_id: hotelId,
          start_date: auditDate.toISODate(),
        },
        headers: this.buildHeaders(apiKey),
        timeout: this.getTimeoutMs(),
      })
      return res.data ?? null
    } catch (err: any) {
      console.error('POSService.getNightAudit error:', err?.message || err)
      throw err
    }
  }

  private static getV2BaseUrl(): string {
    const base = env.get('POS_API_V2_BASE_URL')
    if (!base || base.length === 0) {
      throw new Error('Missing POS_API_V2_BASE_URL in environment')
    }
    // Ensure trailing slash
    return base.endsWith('/') ? base : `${base}/`
  }

  /**
   * Fetch night audit data from the new POS API v2
   * Uses tenant-id and bearer token instead of api-key
   * GET <POS_API_V2_BASE_URL>/pos_night_audit?date=<date>&use_previous_day=true
   * Headers: X-Tenant, Authorization: Bearer <token>
   */
  static async getNightAuditV2(auditDate: DateTime, tenantId: string, tokenKey: string): Promise<any | null> {
    try {
      const url = `${this.getV2BaseUrl()}pos_night_audit`
      const res = await axios.get(url, {
        params: {
          date: auditDate.toISODate(),
          use_previous_day: true,
        },
        headers: {
          'X-Tenant': tenantId,
          'Authorization': `Bearer ${tokenKey}`,
          'accept': 'application/json',
        },
        timeout: this.getTimeoutMs(),
      })
      return res.data ?? null
    } catch (err: any) {
      console.error('POSService.getNightAuditV2 error:', err?.message || err)
      throw err
    }
  }
}

