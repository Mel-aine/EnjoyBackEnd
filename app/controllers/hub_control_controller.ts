import crypto from 'node:crypto'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import Hotel from '#models/hotel'
import HubService, { hubApiBaseUrl } from '#services/hub_service'

/**
 * Control API called by the Enjoy Connectivity Hub
 * (`connect-hub-backend`, docs/enjoy-control-api.md).
 *
 * Auth: `Authorization: Bearer <HUB_CONTROL_KEY>`, the same shared secret the
 * hub keeps in ENJOY_CONTROL_KEY. Enjoy stays the source of truth: the hub only
 * asks here, it never writes the PMS database.
 */

function authorized(ctx: HttpContext): boolean {
  const expected = env.get('HUB_CONTROL_KEY')
  const header = String(ctx.request.header('authorization') ?? '').trim()
  if (!expected || !header) return false

  const raw = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : header
  const left = Buffer.from(String(expected))
  const right = Buffer.from(raw)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function unauthorized(ctx: HttpContext) {
  return ctx.response.unauthorized({
    error: { code: 'unauthorized', message: 'A valid control key is required' },
  })
}

function failed(ctx: HttpContext, error: any) {
  const code = String(error?.code ?? 'internal_error')
  const status =
    code === 'not_found'
      ? 404
      : code === 'not_linked' || code === 'catalog_not_synced' || code === 'validation_failed'
        ? 409
        : code === 'hub_rejected' || code === 'hub_unreachable'
          ? 502
          : 500

  return ctx.response.status(status).send({
    error: { code, message: String(error?.message ?? 'Hub control failed') },
  })
}

async function hotelOf(ctx: HttpContext): Promise<Hotel> {
  const id = Number(ctx.params.hotelId)
  const hotel = Number.isInteger(id) ? await Hotel.find(id) : null
  if (!hotel) {
    const error: any = new Error('Hotel not found')
    error.code = 'not_found'
    throw error
  }
  return hotel
}

export default class HubControlController {
  /** GET /api/hub-control/hotels?search= */
  async hotels(ctx: HttpContext) {
    if (!authorized(ctx)) return unauthorized(ctx)

    const search = String(ctx.request.input('search', '') ?? '').trim()
    const query = Hotel.query().orderBy('hotel_name', 'asc')
    if (search) {
      query.where((builder) => {
        builder
          .whereILike('hotel_name', `%${search}%`)
          .orWhereILike('city', `%${search}%`)
          .orWhereILike('hotel_code', `%${search}%`)
      })
    }

    const hotels = await query
    return ctx.response.ok({
      data: hotels.map((hotel) => ({
        id: hotel.id,
        name: hotel.hotelName,
        city: hotel.city,
        linked: Boolean(hotel.hubPropertyId),
        hub_property_id: hotel.hubPropertyId,
      })),
    })
  }

  /** GET /api/hub-control/hotels/:hotelId/status */
  async status(ctx: HttpContext) {
    if (!authorized(ctx)) return unauthorized(ctx)

    try {
      const hotel = await hotelOf(ctx)
      if (!hotel.hubPropertyId || !hotel.hubApiKey) {
        return ctx.response.ok({
          data: {
            linked: false,
            api_key_valid: false,
            webhook: { url: hotel.hubWebhookUrl, configured: Boolean(hotel.hubWebhookUrl) },
            catalog: {
              room_types: { linked: 0, total: 0 },
              rate_plans: { linked: 0, total: 0 },
            },
            pending_cancellations: 0,
            last_push_at: null,
          },
        })
      }

      const service = new HubService(hotel)
      let apiKeyValid: boolean | null = null
      let catalog = {
        room_types: { linked: 0, total: 0 },
        rate_plans: { linked: 0, total: 0 },
      }
      let error: any = null

      try {
        apiKeyValid = await service.isKeyValid()
        catalog = await service.catalogCounts()
      } catch (cause: any) {
        error = { code: cause?.code ?? 'internal_error', message: cause?.message }
      }

      return ctx.response.ok({
        data: {
          linked: true,
          api_key_valid: apiKeyValid,
          webhook: { url: hotel.hubWebhookUrl, configured: Boolean(hotel.hubWebhookUrl) },
          catalog,
          pending_cancellations: 0,
          last_push_at: hotel.hubLastPushAt,
          error,
        },
      })
    } catch (error) {
      return failed(ctx, error)
    }
  }

  /** POST /api/hub-control/hotels/:hotelId/link */
  async link(ctx: HttpContext) {
    if (!authorized(ctx)) return unauthorized(ctx)

    try {
      const hotel = await hotelOf(ctx)
      const apiKey = String(ctx.request.input('api_key', '') ?? '').trim()
      const hubPropertyId = Number(ctx.request.input('hub_property_id', 0))
      const webhookUrl = String(ctx.request.input('webhook_url', '') ?? '').trim()

      if (!apiKey || apiKey.length < 12) {
        const error: any = new Error('api_key is required')
        error.code = 'validation_failed'
        throw error
      }
      if (!Number.isInteger(hubPropertyId) || hubPropertyId < 1) {
        const error: any = new Error('hub_property_id is required')
        error.code = 'validation_failed'
        throw error
      }

      hotel.hubPropertyId = hubPropertyId
      // One key per hotel: a new link replaces the previous one.
      hotel.hubApiKey = apiKey
      hotel.hubWebhookUrl = webhookUrl || null
      hotel.hubLinkedAt = DateTime.now()
      await hotel.save()

      return ctx.response.ok({
        data: { linked: true, hotel_id: hotel.id, hub_property_id: hotel.hubPropertyId },
      })
    } catch (error) {
      return failed(ctx, error)
    }
  }

  /** POST /api/hub-control/hotels/:hotelId/sync-catalog */
  async syncCatalog(ctx: HttpContext) {
    if (!authorized(ctx)) return unauthorized(ctx)

    try {
      const hotel = await hotelOf(ctx)
      const report = await new HubService(hotel).syncCatalog()
      return ctx.response.ok({ data: report })
    } catch (error) {
      return failed(ctx, error)
    }
  }

  /** POST /api/hub-control/hotels/:hotelId/push-ari { days } */
  async pushAri(ctx: HttpContext) {
    if (!authorized(ctx)) return unauthorized(ctx)

    try {
      const hotel = await hotelOf(ctx)
      const days = Math.min(Math.max(Number(ctx.request.input('days', 365)) || 365, 1), 730)
      const report = await new HubService(hotel).pushAri(days)
      return ctx.response.ok({ data: report })
    } catch (error) {
      return failed(ctx, error)
    }
  }

  /** POST /api/hub-control/hotels/:hotelId/unlink */
  async unlink(ctx: HttpContext) {
    if (!authorized(ctx)) return unauthorized(ctx)

    try {
      const hotel = await hotelOf(ctx)
      await new HubService(hotel).unlink()
      return ctx.response.ok({ data: { linked: false, hotel_id: hotel.id } })
    } catch (error) {
      return failed(ctx, error)
    }
  }

  /** GET /api/hub-control/health — cheap check for the hub operator. */
  async health({ response }: HttpContext) {
    return response.ok({ data: { ok: true, hub_api: hubApiBaseUrl() } })
  }
}
