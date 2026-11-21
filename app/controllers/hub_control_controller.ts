import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import Hotel from '#models/hotel'
import HubCatalogSync from '#services/hub_catalog_sync'
import HubLinkService from '#services/hub_link_service'
import HubPushService from '#services/hub_push_service'
import HubStatusService from '#services/hub_status_service'

/**
 * Control API called by the hub console (Administration > Liaison PMS).
 *
 * Contract: connect-hub-backend/docs/enjoy-control-api.md.
 * Every route is behind `HUB_CONTROL_KEY` (hubControl middleware). The commands
 * `node ace hub:*` run the very same services.
 *
 * The hub never reads enjoy's database: these routes ask enjoy to push, exactly
 * as the CLI does. Enjoy stays the source of truth.
 */

function errorBody(code: string, message: string) {
  return { error: { code, message } }
}

function notFound(ctx: HttpContext, message = 'Hotel not found') {
  return ctx.response.notFound(errorBody('not_found', message))
}

function conflict(ctx: HttpContext, message: string) {
  return ctx.response.status(409).json(errorBody('not_linked', message))
}

function invalid(ctx: HttpContext, message: string) {
  return ctx.response.status(422).json(errorBody('validation_failed', message))
}

function internal(ctx: HttpContext, err: unknown) {
  return ctx.response.internalServerError(
    errorBody('internal_error', err instanceof Error ? err.message : String(err))
  )
}

/**
 * A hotel can be linked (key + property saved) while enjoy itself cannot push:
 * HUB_ENABLED/HUB_BASE_URL decide whether anything leaves the installation.
 * Say it explicitly instead of a misleading "not linked".
 */
function pushDisabled(ctx: HttpContext) {
  return ctx.response.internalServerError(
    errorBody(
      'hub_disabled',
      'The hub integration is off on enjoy: set HUB_ENABLED=true and HUB_BASE_URL, then restart enjoy.'
    )
  )
}

async function findHotel(ctx: HttpContext): Promise<Hotel | null> {
  const id = Number(ctx.params.hotelId)
  if (!Number.isInteger(id) || id <= 0) return null
  return Hotel.find(id)
}

export default class HubControlController {
  /** GET /hotels?search= */
  async hotels(ctx: HttpContext) {
    const search = String(ctx.request.input('search', '')).trim()
    const query = Hotel.query().orderBy('id', 'asc').limit(200)
    if (search) {
      const like = `%${search.toLowerCase()}%`
      query.whereRaw('(LOWER(hotel_name) LIKE ? OR LOWER(COALESCE(city, \'\')) LIKE ?)', [
        like,
        like,
      ])
    }

    const hotels = await query
    return ctx.response.ok({
      data: hotels.map((hotel) => ({
        id: hotel.id,
        name: hotel.hotelName,
        city: hotel.city,
        linked: Boolean(hotel.hubApiKey && hotel.hubPropertyId),
        hub_property_id: hotel.hubPropertyId,
      })),
    })
  }

  /** GET /hotels/:id/status */
  async status(ctx: HttpContext) {
    const hotel = await findHotel(ctx)
    if (!hotel) return notFound(ctx)

    try {
      return ctx.response.ok({ data: await HubStatusService.forHotel(hotel) })
    } catch (err) {
      return internal(ctx, err)
    }
  }

  /** POST /hotels/:id/link { api_key, hub_property_id, webhook_url? } */
  async link(ctx: HttpContext) {
    const hotel = await findHotel(ctx)
    if (!hotel) return notFound(ctx)

    const apiKey = String(ctx.request.input('api_key', '')).trim()
    const hubPropertyId = Number(ctx.request.input('hub_property_id', 0))
    if (!apiKey) return invalid(ctx, 'api_key is required')
    if (!Number.isInteger(hubPropertyId) || hubPropertyId <= 0) {
      return invalid(ctx, 'hub_property_id must be a positive integer')
    }

    const rawWebhook = ctx.request.input('webhook_url')
    const webhookUrl = rawWebhook === undefined || rawWebhook === null || rawWebhook === ''
      ? null
      : String(rawWebhook)

    try {
      const outcome = await HubLinkService.link(hotel, {
        apiKey,
        hubPropertyId,
        webhookUrl,
      })
      return ctx.response.ok({
        data: {
          linked: outcome.linked,
          hotel_id: hotel.id,
          hub_property_id: hotel.hubPropertyId,
          webhook_registered: outcome.webhookRegistered,
        },
      })
    } catch (err) {
      return this.linkError(ctx, err)
    }
  }

  /** POST /hotels/:id/sync-catalog */
  async syncCatalog(ctx: HttpContext) {
    const hotel = await findHotel(ctx)
    if (!hotel) return notFound(ctx)
    if (!hotel.hubApiKey || !hotel.hubPropertyId) return conflict(ctx, 'Hotel is not linked')
    if (!env.get('HUB_ENABLED') || !env.get('HUB_BASE_URL')) return pushDisabled(ctx)

    try {
      const report = await HubCatalogSync.sync(hotel.id)
      return ctx.response.ok({
        data: {
          hotel_id: hotel.id,
          room_types_created: report.roomTypesCreated,
          room_types_reused: report.roomTypesReused,
          rate_plans_created: report.ratePlansCreated,
          rate_plans_reused: report.ratePlansReused,
          links: report.links,
        },
      })
    } catch (err) {
      return this.linkError(ctx, err)
    }
  }

  /** POST /hotels/:id/push-ari { days } */
  async pushAri(ctx: HttpContext) {
    const hotel = await findHotel(ctx)
    if (!hotel) return notFound(ctx)
    if (!hotel.hubApiKey || !hotel.hubPropertyId) return conflict(ctx, 'Hotel is not linked')
    if (!env.get('HUB_ENABLED') || !env.get('HUB_BASE_URL')) return pushDisabled(ctx)

    const days = Number(ctx.request.input('days', 365))

    try {
      const report = await HubPushService.pushAri(hotel, days)
      return ctx.response.ok({ data: report })
    } catch (err) {
      return this.linkError(ctx, err)
    }
  }

  /** POST /hotels/:id/unlink */
  async unlink(ctx: HttpContext) {
    const hotel = await findHotel(ctx)
    if (!hotel) return notFound(ctx)

    try {
      await HubLinkService.unlink(hotel)
      return ctx.response.ok({ data: { linked: false, hotel_id: hotel.id } })
    } catch (err) {
      return internal(ctx, err)
    }
  }

  /** Maps a service failure to the codes the hub expects. */
  private linkError(ctx: HttpContext, err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (/not found/i.test(message)) return notFound(ctx, message)
    if (/No hub API key|not linked/i.test(message)) return conflict(ctx, message)
    if (/HUB_BASE_URL/.test(message)) return internal(ctx, err)
    return invalid(ctx, message)
  }
}
