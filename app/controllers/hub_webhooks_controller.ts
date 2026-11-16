import crypto from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import Hotel from '#models/hotel'
import HubBookingSync from '#services/hub_booking_sync'
import { isHubEnabled } from '#services/hub_service'

/** Maximum age of a signed webhook (replay protection). */
const TOLERANCE_SECONDS = 300

/**
 * Checks `X-Hub-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`.
 */
export function verifyHubSignature(
  secret: string,
  header: string | undefined | null,
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!secret || !header) return false
  const parts = Object.fromEntries(
    String(header)
      .split(',')
      .map((p) => p.trim().split('=') as [string, string])
      .filter(([k, v]) => k && v)
  )
  const timestamp = Number(parts.t)
  const signature = parts.v1
  if (!Number.isFinite(timestamp) || !signature) return false
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(signature, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * POST /api/webhooks/hub/:hotelId — the hub rings: a booking waits in its feed.
 * The webhook only triggers a feed read; the feed is the source of truth, so
 * a lost or replayed webhook changes nothing (the 1-minute cron catches up).
 */
export default class HubWebhooksController {
  async handle({ params, request, response }: HttpContext) {
    if (!isHubEnabled()) return response.notFound({ error: 'not_found' })

    const hotelId = Number(params.hotelId)
    const hotel = Number.isInteger(hotelId) ? await Hotel.find(hotelId) : null
    if (!hotel || !hotel.hubApiKey || !hotel.hubWebhookSecret) {
      return response.notFound({ error: 'not_found' })
    }

    const raw = request.raw() ?? ''
    if (!verifyHubSignature(hotel.hubWebhookSecret, request.header('x-hub-signature'), raw)) {
      return response.unauthorized({ error: 'invalid_signature' })
    }

    const type = request.input('type')
    if (type === 'booking.revision' || type === 'test' || !type) {
      HubBookingSync.trigger(hotel.id)
    }
    return response.accepted({ status: 'accepted' })
  }
}
