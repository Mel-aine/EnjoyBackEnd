import { DateTime } from 'luxon'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import Hotel from '#models/hotel'
import Reservation from '#models/reservation'
import RoomType from '#models/room_type'
import RoomRate from '#models/room_rate'
import Currency from '#models/currency'
import CurrencyCacheService from '#services/currency_cache_service'
import LoggerService from '#services/logger_service'
import ReservationCreationService from '#services/reservation_creation_service'
import HubService, { HubError, isHubEnabled } from '#services/hub_service'
import { HUB_CANCEL_STATUSES, markSynced } from '#services/hub_cancel_sync'
import ReservationFolioService from '#services/reservation_folio_service'
import Folio from '#models/folio'
import { LockNamespace, withTryLock } from '#services/advisory_lock'

/**
 * Brings Hub OTA bookings (KasaStay and other local OTAs) into enjoy.
 *
 * Flow (flux A / E1 of flux-hub-ota.md):
 *   hub webhook `booking.revision` or the 1-minute cron
 *     → GET /bookings/feed (always from cursor 0: only un-acked revisions)
 *     → confirmed: create the reservation (same path as Channex bookings)
 *       cancelled: cancel it (same path as a Channex cancellation)
 *     → POST /bookings/revisions/{id}/ack with the revision_seq that was read
 *
 * Safe to run twice at the same time: the reservation is found by
 * (hotel_id, hub_booking_id), which is unique in the database, and the hub
 * refuses an ack for a revision that is no longer the latest (409).
 * A booking that cannot be created (unmapped room type…) is not acked and
 * stays in the feed until it is fixed.
 */

type HubBooking = {
  id: number
  propertyId?: number
  status: string
  origin?: string
  checkin: string
  checkout: string
  rooms?: Array<{
    room_type_id: number
    rate_plan_id?: number
    quantity?: number
    adults?: number
    children?: number
  }>
  customer?: { name?: string; email?: string; phone?: string; [k: string]: any } | null
  currency?: string
  totalAmount?: number | string | null
  cancellationFee?: number | string | null
  otaReference?: string | null
  otaName?: string | null
  otaReservationCode?: string | null
  paymentCollect?: string | null
  revisionSeq?: number | string | null
}

export type HubSyncResult = {
  hotelId: number
  created: number
  cancelled: number
  acked: number
  skipped: number
  errors: Array<{ bookingId: number; error: string }>
}

type CreateData = Parameters<typeof ReservationCreationService.createReservation>[0]

const PAGE_SIZE = 50
/**
 * Bookings that cannot be created stay un-acked at the head of the feed: page
 * far enough (10 000 rows) that they never hide newer bookings.
 */
const MAX_PAGES = 200

/** One run at a time per hotel in this process; a request during a run is replayed after it. */
const running = new Set<number>()
const rerun = new Set<number>()

function systemUserId(): number {
  // Same rule as the Channex booking sync.
  return Number(env.get('AUTOPROCESS_USER_ID') ?? 2)
}

function dateOnly(value: string): string {
  return String(value).slice(0, 10)
}

function splitName(name: string | undefined): { firstName: string; lastName: string } {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { firstName: 'Client', lastName: 'OTA' }
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export default class HubBookingSync {
  /** Fire-and-forget entry point for the webhook. Never throws. */
  static trigger(hotelId: number) {
    setImmediate(() => {
      HubBookingSync.syncHotel(hotelId).catch((err) =>
        logger.error({ err, hotelId }, '[Hub] booking sync failed')
      )
    })
  }

  /** Reads the feed of every hotel linked to the hub (cron fallback). */
  static async syncAll(): Promise<HubSyncResult[]> {
    if (!isHubEnabled()) return []
    const hotels = await Hotel.query().whereNotNull('hub_api_key').select(['id'])
    const results: HubSyncResult[] = []
    for (const { id } of hotels) {
      try {
        const res = await HubBookingSync.syncHotel(id)
        if (res) results.push(res)
      } catch (err) {
        logger.error({ err, hotelId: id }, '[Hub] booking sync failed')
      }
    }
    return results
  }

  static async syncHotel(hotelId: number): Promise<HubSyncResult | null> {
    if (running.has(hotelId)) {
      rerun.add(hotelId)
      return null
    }
    running.add(hotelId)
    try {
      let result: HubSyncResult | null = null
      do {
        rerun.delete(hotelId)
        // Other enjoy instances may read the same feed: one at a time per hotel.
        const run = await withTryLock(LockNamespace.hubBookingSync, hotelId, () => runOnce(hotelId))
        result = run.locked ? null : run.value
      } while (rerun.has(hotelId))
      return result
    } finally {
      running.delete(hotelId)
    }
  }

  /** Builds the enjoy reservation data from a hub booking. Exposed for tests. */
  static async toReservationData(
    hotel: Hotel,
    booking: HubBooking,
    userId: number
  ): Promise<CreateData> {
    const lines = Array.isArray(booking.rooms) ? booking.rooms : []
    if (!lines.length) throw new Error('Booking has no room')

    const hubRoomTypeIds = lines.map((l) => Number(l.room_type_id))
    const hubRatePlanIds = lines.map((l) => Number(l.rate_plan_id)).filter(Boolean)

    const roomTypes = await RoomType.query()
      .where('hotel_id', hotel.id)
      .whereIn('hub_room_type_id', hubRoomTypeIds)
      .select(['id', 'hub_room_type_id'])
    const roomTypeByHub = new Map(roomTypes.map((rt) => [rt.hubRoomTypeId!, rt.id]))

    const roomRates = hubRatePlanIds.length
      ? await RoomRate.query()
          .where('hotel_id', hotel.id)
          .whereIn('hub_rate_plan_id', hubRatePlanIds)
          .select(['id', 'rate_type_id', 'hub_rate_plan_id'])
      : []
    const rateByHub = new Map(roomRates.map((rr) => [rr.hubRatePlanId!, rr]))

    const missing = hubRoomTypeIds.filter((id) => !roomTypeByHub.has(id))
    if (missing.length) {
      throw new Error(`Hub room type(s) not mapped in enjoy: ${[...new Set(missing)].join(', ')}`)
    }

    const checkin = dateOnly(booking.checkin)
    const checkout = dateOnly(booking.checkout)
    const nights = Math.max(
      1,
      Math.round(DateTime.fromISO(checkout).diff(DateTime.fromISO(checkin), 'days').days)
    )

    // Currency: same conversion as Channex bookings.
    const defaultCurrency = await CurrencyCacheService.getHotelDefaultCurrency(hotel.id)
    const baseCurrency = String(defaultCurrency?.currencyCode || '').toUpperCase()
    const bookingCurrency = String(booking.currency || baseCurrency || '').toUpperCase()
    const isCrossRate = !!bookingCurrency && !!baseCurrency && bookingCurrency !== baseCurrency
    let exchangeRate = 1
    if (isCrossRate) {
      const source = await Currency.query()
        .where('hotelId', hotel.id)
        .where('currencyCode', bookingCurrency)
        .select('exchangeRate', 'currencyCode')
        .first()
      exchangeRate = Number(source?.exchangeRate)
      // A wrong rate would book a wrong amount silently: leave the booking in
      // the feed (not acked) until the currency is configured in enjoy.
      if (!source || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        throw new Error(
          `No exchange rate for ${bookingCurrency} in hotel ${hotel.id} (base ${baseCurrency})`
        )
      }
    }

    // The hub keeps the booking total only: it is split evenly over rooms and nights.
    const roomCount = lines.reduce((sum, l) => sum + Math.max(1, Number(l.quantity ?? 1)), 0)
    const total = Number(booking.totalAmount ?? 0) || 0
    const nightlySrc = roomCount > 0 ? total / (roomCount * nights) : 0

    const rooms: NonNullable<CreateData['rooms']> = []
    for (const line of lines) {
      const rate = line.rate_plan_id ? rateByHub.get(Number(line.rate_plan_id)) : undefined
      for (let i = 0; i < Math.max(1, Number(line.quantity ?? 1)); i++) {
        rooms.push({
          room_type_id: roomTypeByHub.get(Number(line.room_type_id))!,
          room_rate_id: rate?.id ?? null,
          rate_type_id: rate?.rateTypeId ?? null,
          adult_count: Number(line.adults ?? 1) || 1,
          child_count: Number(line.children ?? 0) || 0,
          room_rate: exchangeRate * nightlySrc,
          nights,
          checkin_date: checkin,
          checkout_date: checkout,
          original_room_rate: nightlySrc,
          original_currency_code: bookingCurrency || baseCurrency,
          original_exchange_rate: isCrossRate ? exchangeRate : 1,
          // What the hub sold: left out of the stock sent back to the hub.
          hub_sold_from: checkin,
          hub_sold_to: checkout,
        })
      }
    }

    const customer = booking.customer ?? {}
    const { firstName, lastName } = splitName(customer.name)

    return {
      hotel_id: hotel.id,
      arrived_date: checkin,
      depart_date: checkout,
      created_by: userId,
      check_in_time: '14:00',
      check_out_time: '12:00',
      status: 'confirmed',
      guest: {
        firstName,
        lastName,
        email: customer.email as string,
        phone: customer.phone,
      },
      rooms,
      total_amount: exchangeRate * total,
      ota_name: booking.otaName || 'OTA local',
      ota_status: booking.status,
      ota_reservation_code:
        booking.otaReservationCode || booking.otaReference || `HUB-${booking.id}`,
      payment_collect: booking.paymentCollect ?? undefined,
      hub_booking_id: booking.id,
      hub_revision_seq:
        booking.revisionSeq !== null && booking.revisionSeq !== undefined
          ? Number(booking.revisionSeq)
          : null,
    }
  }
}

async function runOnce(hotelId: number): Promise<HubSyncResult | null> {
  const hotel = await Hotel.find(hotelId)
  const client = HubService.forHotel(hotel)
  if (!hotel || !client) return null

  const result: HubSyncResult = {
    hotelId,
    created: 0,
    cancelled: 0,
    acked: 0,
    skipped: 0,
    errors: [],
  }
  const userId = systemUserId()

  // Always start from 0: the feed only holds what is not acked yet; the
  // cursor is only used to page within this run.
  let cursor = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const feed = await client.getBookingsFeed(cursor, PAGE_SIZE)
    const rows: HubBooking[] = Array.isArray(feed?.data) ? feed.data : []
    for (const booking of rows) {
      try {
        await processBooking(client, hotel, booking, userId, result)
      } catch (err) {
        const message = (err as any)?.message ?? String(err)
        result.errors.push({ bookingId: booking.id, error: message })
        await logError(hotel.id, booking, message)
      }
    }
    const next = Number(feed?.next_cursor ?? cursor)
    if (rows.length < PAGE_SIZE || next <= cursor) break
    cursor = next
  }

  if (result.created || result.cancelled || result.errors.length) {
    logger.info({ ...result }, '[Hub] booking sync')
  }
  return result
}

async function processBooking(
  client: HubService,
  hotel: Hotel,
  booking: HubBooking,
  userId: number,
  result: HubSyncResult
) {
  // Only bookings made on a local OTA. The feed may also hold demo bookings
  // of the hub console and bookings imported from Channex before the hub's
  // Channex link was switched off: those must never become enjoy reservations
  // (Channex ones already reach enjoy through its own Channex integration).
  if (booking.origin && booking.origin !== 'local_ota') {
    result.skipped++
    return
  }

  // A PMS key can cover several hub properties: only take this hotel's.
  if (
    hotel.hubPropertyId &&
    booking.propertyId &&
    Number(booking.propertyId) !== hotel.hubPropertyId
  ) {
    result.skipped++
    return
  }

  const existing = await Reservation.query()
    .where('hotel_id', hotel.id)
    .where('hub_booking_id', booking.id)
    .first()

  if (booking.status === 'confirmed') {
    if (!existing) {
      const data = await HubBookingSync.toReservationData(hotel, booking, userId)
      const created = await ReservationCreationService.createReservation(data)
      if (!created.success) {
        // A concurrent run may have created it first (unique index): check again.
        const again = await Reservation.query()
          .where('hotel_id', hotel.id)
          .where('hub_booking_id', booking.id)
          .first()
        if (!again)
          throw new Error(created.error || created.message || 'Reservation creation failed')
      } else {
        result.created++
      }
    }
    await ensureFolios(hotel.id, booking, userId)
    await ack(client, booking, result)
    return
  }

  if (booking.status === 'cancelled') {
    // The hub already knows: stamp first so the cancellation is not sent back to it.
    if (existing && !existing.hubCancelSyncedAt) await markSynced(existing.id)

    if (existing && !HUB_CANCEL_STATUSES.includes(existing.status)) {
      await existing.load('reservationRooms')
      await existing.load('folios')
      const fee = Number(booking.cancellationFee ?? 0) || 0
      await ReservationCreationService.cancelReservation(
        existing,
        userId,
        `Annulée par ${booking.otaName || "l'OTA"} via le hub`,
        undefined,
        fee > 0 ? fee : undefined
      )
      if (booking.revisionSeq !== null && booking.revisionSeq !== undefined) {
        await Reservation.query()
          .where('id', existing.id)
          .update({ hub_revision_seq: Number(booking.revisionSeq) })
      }
      result.cancelled++
    }
    // Cancelled before enjoy ever created it: nothing to undo, just ack.
    await ack(client, booking, result)
    return
  }

  // pending / expired never reach the feed; ignore anything else.
  result.skipped++
}

/**
 * createReservation commits the reservation, then creates the folios: if that
 * last step fails, the reservation exists without folio. Retry once here, and
 * tell the hotel if it still fails. The booking is acked anyway: it exists in
 * enjoy, and keeping it in the feed would not create the folio either.
 */
async function ensureFolios(hotelId: number, booking: HubBooking, userId: number) {
  const reservation = await Reservation.query()
    .where('hotel_id', hotelId)
    .where('hub_booking_id', booking.id)
    .first()
  if (!reservation) return
  const folio = await Folio.query().where('reservation_id', reservation.id).first()
  if (folio) return
  try {
    await ReservationFolioService.createFoliosOnConfirmation(reservation.id, userId)
  } catch (err) {
    const message = (err as any)?.message ?? String(err)
    logger.error({ err, reservationId: reservation.id }, '[Hub] folio creation failed')
    await LoggerService.logActivity({
      action: 'ERROR',
      resourceType: 'HubBooking',
      resourceId: reservation.id,
      description: `Réservation du hub OTA #${booking.id} créée sans folio : ${message}`,
      hotelId,
    }).catch(() => {})
  }
}

async function ack(client: HubService, booking: HubBooking, result: HubSyncResult) {
  try {
    await client.ackBooking(booking.id, booking.revisionSeq)
    result.acked++
  } catch (err) {
    // A newer revision exists (e.g. cancelled meanwhile): it stays in the feed
    // and is handled on the next run.
    if (err instanceof HubError && err.code === 'stale_revision') return
    throw err
  }
}

/** Last activity-log entry per booking: a stuck booking is retried every minute. */
const lastLogged = new Map<string, { message: string; at: number }>()
const RELOG_AFTER_MS = 60 * 60 * 1000

async function logError(hotelId: number, booking: HubBooking, message: string) {
  logger.warn({ hotelId, bookingId: booking.id, message }, '[Hub] booking not processed')
  const key = `${hotelId}:${booking.id}`
  const previous = lastLogged.get(key)
  if (previous && previous.message === message && Date.now() - previous.at < RELOG_AFTER_MS) return
  lastLogged.set(key, { message, at: Date.now() })
  try {
    await LoggerService.logActivity({
      action: 'ERROR',
      resourceType: 'HubBooking',
      resourceId: booking.id,
      description: `Réservation du hub OTA #${booking.id} non intégrée : ${message}`,
      details: { bookingId: booking.id, status: booking.status, error: message },
      hotelId,
    })
  } catch {}
}
