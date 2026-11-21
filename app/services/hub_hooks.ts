import env from '#start/env'
import type { AvailabilityChange } from '#services/hub_availability_sync'

/**
 * Entry points for model hooks (Reservation, ReservationRoom, RoomBlock).
 *
 * This file imports no model on purpose: models import it, and a static import
 * of the sync service (which imports models) would change the load order of
 * the existing model import cycles. The service is loaded lazily instead.
 *
 * Values before and after the change are read synchronously here, because
 * Lucid resets `$original` once the save is done.
 *
 * Never throws; does nothing unless HUB_ENABLED=true.
 */

function enabled(): boolean {
  try {
    return env.get('HUB_ENABLED', false) === true
  } catch {
    return false
  }
}

function send(change: AvailabilityChange) {
  import('#services/hub_availability_sync')
    .then(({ default: HubAvailabilitySync }) => HubAvailabilitySync.enqueue(change))
    .catch(() => {})
}

export function hubOnReservationRoomChange(model: any) {
  try {
    if (!enabled()) return
    const original = model?.$original ?? {}
    send({
      hotelId: model?.hotelId,
      roomTypeIds: [model?.roomTypeId, original.roomTypeId],
      roomIds: [model?.roomId, original.roomId],
      dates: [model?.checkInDate, model?.checkOutDate, original.checkInDate, original.checkOutDate],
      trx: model?.$trx,
    })
  } catch {}
}

export function hubOnReservationChange(model: any) {
  try {
    if (!enabled()) return
    const original = model?.$original ?? {}
    send({
      hotelId: model?.hotelId,
      // Unknown on creation: its rooms are saved afterwards and trigger their own push.
      reservationId: model?.$isPersisted ? model?.id : null,
      dates: [model?.arrivedDate, model?.departDate, original.arrivedDate, original.departDate],
      trx: model?.$trx,
    })

    // Flux E3: a local-OTA booking cancelled in enjoy must be cancelled in the hub.
    if (
      model?.hubBookingId &&
      !model?.hubCancelSyncedAt &&
      CANCEL_STATUSES.includes(String(model?.status))
    ) {
      const hotelId = Number(model.hotelId)
      const run = () =>
        import('#services/hub_cancel_sync')
          .then(({ default: HubCancelSync }) => HubCancelSync.trigger(hotelId))
          .catch(() => {})
      const trx = model?.$trx
      if (trx && !trx.isCompleted && typeof trx.after === 'function') trx.after('commit', run)
      else run()
    }
  } catch {}
}

/**
 * Price change: the saved room rate is pushed to the hub right away (debounced).
 * Same rule as the other hooks: lazy import, never throws.
 */
export function hubOnRoomRateChange(model: any) {
  try {
    if (!enabled()) return
    if (!model?.hubRatePlanId) return
    const copy = {
      id: model?.id,
      hubRatePlanId: model?.hubRatePlanId,
      hotelId: model?.hotelId,
    }
    import('#services/hub_rate_sync')
      .then(({ default: HubRateSync }) => HubRateSync.pushRateLater(copy as any))
      .catch(() => {})
  } catch {}
}

/** Same as HUB_CANCEL_STATUSES (hub_cancel_sync.ts), kept here to avoid importing models. */
const CANCEL_STATUSES = ['cancelled', 'voided']

export function hubOnRoomBlockChange(model: any) {
  try {
    if (!enabled()) return
    const original = model?.$original ?? {}
    send({
      hotelId: model?.hotelId,
      roomTypeIds: [model?.roomTypeId, original.roomTypeId],
      roomIds: [model?.roomId, original.roomId],
      dates: [
        model?.blockFromDate,
        model?.blockToDate,
        original.blockFromDate,
        original.blockToDate,
      ],
      trx: model?.$trx,
    })
  } catch {}
}
