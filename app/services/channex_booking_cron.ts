import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import Hotel from '#models/hotel'

/**
 * Periodic read of the Channex booking feed (Booking.com, Airbnb, Expedia…).
 *
 * It runs the exact same code as `POST /api/channex/sync/bookings/:hotelId`
 * (ChannexMigrationController.syncBookingsFromChannex) for every hotel linked
 * to Channex: create / update / cancel the reservations, then acknowledge
 * them to Channex.
 *
 * Off unless CHANNEX_BOOKING_SYNC_CRON=true. Before enabling it, make sure no
 * external scheduler already calls that route: the sync dedupes by preloading
 * existing reservations, so two runs at the same time could create the same
 * booking twice.
 *
 * A Postgres advisory lock per hotel makes sure only one run of this cron
 * works on a hotel at a time, even with several enjoy instances.
 */

/** Advisory lock namespace ("Channex booking sync"). */
const LOCK_NAMESPACE = 7301

export type ChannexSyncOutcome = {
  hotelId: number
  status: 'done' | 'locked' | 'failed'
  httpStatus?: number
  created?: number
  updated?: number
  errors?: number
  message?: string
}

export function isChannexBookingCronEnabled(): boolean {
  return env.get('CHANNEX_BOOKING_SYNC_CRON', false) === true
}

/** Minimal HttpContext response that records what the controller answers. */
function captureResponse() {
  const out: { status: number; body: any } = { status: 200, body: null }
  const set = (status: number) => (body: any) => {
    out.status = status
    out.body = body
    return body
  }
  const response = {
    ok: set(200),
    badRequest: set(400),
    unauthorized: set(401),
    forbidden: set(403),
    notFound: set(404),
    internalServerError: set(500),
    status: (status: number) => ({ json: set(status), send: set(status) }),
  }
  return { out, response }
}

export default class ChannexBookingCron {
  static async runAll(): Promise<ChannexSyncOutcome[]> {
    if (!isChannexBookingCronEnabled()) return []
    const hotels = await Hotel.query().whereNotNull('channex_property_id').select(['id'])
    const results: ChannexSyncOutcome[] = []
    for (const { id } of hotels) {
      results.push(await ChannexBookingCron.runHotel(id))
    }
    return results
  }

  static async runHotel(hotelId: number): Promise<ChannexSyncOutcome> {
    try {
      // The transaction only holds the advisory lock (released at commit);
      // the sync itself uses its own connections as it does over HTTP.
      return await db.transaction(async (trx) => {
        const res: any = await trx.rawQuery('select pg_try_advisory_xact_lock(?, ?) as locked', [
          LOCK_NAMESPACE,
          hotelId,
        ])
        if (!res?.rows?.[0]?.locked) return { hotelId, status: 'locked' as const }

        const { default: ChannexMigrationController } = await import(
          '#controllers/channex_migration_controller'
        )
        const controller = new ChannexMigrationController()
        const { out, response } = captureResponse()
        await controller.syncBookingsFromChannex({
          params: { hotelId: String(hotelId) },
          response,
          auth: {},
        } as any)

        const data = out.body?.data ?? {}
        return {
          hotelId,
          status: out.status >= 400 ? ('failed' as const) : ('done' as const),
          httpStatus: out.status,
          created: Number(data.totalCreated ?? 0),
          updated: Number(data.totalUpdated ?? 0),
          errors: Number(data.totalErrors ?? 0),
          message: out.body?.message ?? out.body?.error,
        }
      })
    } catch (err) {
      logger.error({ err, hotelId }, '[ChannexCron] booking sync failed')
      return { hotelId, status: 'failed', message: (err as any)?.message }
    }
  }
}
