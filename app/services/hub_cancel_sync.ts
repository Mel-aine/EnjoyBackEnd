import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import Hotel from '#models/hotel'
import Reservation, { ReservationStatus } from '#models/reservation'
import LoggerService from '#services/logger_service'
import HubService, { HubError, isHubEnabled } from '#services/hub_service'
import { LockNamespace, withTryLock } from '#services/advisory_lock'

/**
 * Flux E3: the hotel cancels in enjoy a booking that came from a local OTA.
 * The hub frees the stock and sends `booking.cancelled_by_property` to the
 * OTA, which refunds and tells the customer.
 *
 * Durable: a cancelled hub reservation with `hub_cancel_synced_at` null is
 * still to send. It is sent right after the cancellation (model hook) and
 * retried every minute (cron) until the hub answers, so a hub outage never
 * loses a cancellation. The hub call is idempotent (already cancelled = ok).
 *
 * Cancellations that come from the hub itself are stamped before being
 * applied in enjoy (HubBookingSync), so they are not sent back.
 */

/** enjoy statuses that free the room: the hub booking must be cancelled too. */
export const HUB_CANCEL_STATUSES = [
  ReservationStatus.CANCELLED,
  ReservationStatus.VOIDED,
] as string[]

const BATCH = 50
const running = new Set<number>()
const timers = new Map<number, NodeJS.Timeout>()

export default class HubCancelSync {
  /** Schedules a send for a hotel shortly (after the caller's commit). Never throws. */
  static trigger(hotelId: number, delayMs = 1500) {
    try {
      if (!isHubEnabled() || !hotelId || timers.has(hotelId)) return
      const timer = setTimeout(() => {
        timers.delete(hotelId)
        HubCancelSync.syncHotel(hotelId).catch((err) =>
          logger.error({ err, hotelId }, '[Hub] cancellation sync failed')
        )
      }, delayMs)
      timer.unref?.()
      timers.set(hotelId, timer)
    } catch {}
  }

  /** Cron: every hotel with cancellations still to send. */
  static async syncAll() {
    if (!isHubEnabled()) return
    const rows = await Reservation.query()
      .whereNotNull('hub_booking_id')
      .whereNull('hub_cancel_synced_at')
      .whereIn('status', HUB_CANCEL_STATUSES)
      .distinct('hotel_id')
      .select('hotel_id')
    for (const row of rows) {
      try {
        await HubCancelSync.syncHotel(row.hotelId)
      } catch (err) {
        logger.error({ err, hotelId: row.hotelId }, '[Hub] cancellation sync failed')
      }
    }
  }

  static async syncHotel(hotelId: number): Promise<{ sent: number; failed: number }> {
    const result = { sent: 0, failed: 0 }
    if (running.has(hotelId)) return result
    running.add(hotelId)
    try {
      // Other enjoy instances may send the same cancellations: one at a time per hotel.
      const run = await withTryLock(LockNamespace.hubCancelSync, hotelId, () =>
        sendPending(hotelId, result)
      )
      return run.locked ? result : run.value
    } finally {
      running.delete(hotelId)
    }
  }
}

async function sendPending(hotelId: number, result: { sent: number; failed: number }) {
  const hotel = await Hotel.find(hotelId)
  const client = HubService.forHotel(hotel)
  if (!hotel || !client) return result

  const reservations = await Reservation.query()
    .where('hotel_id', hotelId)
    .whereNotNull('hub_booking_id')
    .whereNull('hub_cancel_synced_at')
    .whereIn('status', HUB_CANCEL_STATUSES)
    .orderBy('id', 'asc')
    .limit(BATCH)

  for (const reservation of reservations) {
    try {
      await client.cancelBookingByProperty(
        reservation.hubBookingId!,
        reservation.cancellationReason || undefined
      )
      await markSynced(reservation.id)
      result.sent++
    } catch (err) {
      result.failed++
      const e = err as HubError
      // Network error, 429, 5xx: retried by the next run. 401/403 too: the
      // hub key was revoked or rotated, the cancellation must go once the
      // key is fixed, so the hotel is told and nothing is dropped.
      const authError = e instanceof HubError && (e.status === 401 || e.status === 403)
      const retryable =
        !(e instanceof HubError) ||
        e.status === 0 ||
        e.status === 429 ||
        e.status >= 500 ||
        authError
      if (authError) await reportAuthError(hotelId, e)
      if (!retryable) {
        // 404 / 422 not_hub_booking…: retrying would fail forever. Stop and tell the hotel.
        await markSynced(reservation.id)
        await LoggerService.logActivity({
          action: 'ERROR',
          resourceType: 'HubCancellation',
          resourceId: reservation.id,
          description: `Annulation non transmise au hub OTA (réservation hub #${reservation.hubBookingId}) : ${e.code ?? e.message}`,
          details: { status: e.status, code: e.code, body: e.body },
          hotelId,
        }).catch(() => {})
      } else {
        logger.warn(
          { hotelId, reservationId: reservation.id, err: e?.message },
          '[Hub] cancellation will be retried'
        )
      }
    }
  }
  return result
}

/** At most one activity log per hotel and hour for a rejected hub key. */
const lastAuthReport = new Map<number, number>()

async function reportAuthError(hotelId: number, e: HubError) {
  const last = lastAuthReport.get(hotelId) ?? 0
  if (Date.now() - last < 60 * 60 * 1000) return
  lastAuthReport.set(hotelId, Date.now())
  await LoggerService.logActivity({
    action: 'ERROR',
    resourceType: 'HubCancellation',
    resourceId: hotelId,
    description: `Le hub OTA refuse la clé de l'hôtel (${e.status}) : les annulations restent en attente`,
    details: { status: e.status, code: e.code },
    hotelId,
  }).catch(() => {})
}

/** Marks a reservation as known by the hub (sent, or cancelled by the hub itself). */
export async function markSynced(reservationId: number) {
  await Reservation.query()
    .where('id', reservationId)
    .update({ hub_cancel_synced_at: DateTime.now().toSQL() })
}
