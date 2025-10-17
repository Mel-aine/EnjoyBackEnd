import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import ReservationGuest from '#models/reservation_guest'
import Guest from '#models/guest'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class GuestSummaryService {
  /**
   * Recompute summary fields (first/last reservation and arrival dates)
   * for all guests associated with the given reservation (primary + pivot guests).
   */
  static async recomputeFromReservation(
    reservationId: number,
    trx?: TransactionClientContract
  ): Promise<void> {
    const reservation = await Reservation.query({ client: trx })
      .where('id', reservationId)
      .preload('reservationGuests')
      .first()

    if (!reservation) return

    const guestIds = new Set<number>()
    if (reservation.guestId) guestIds.add(reservation.guestId)
    for (const rg of reservation.reservationGuests) {
      if (rg.guestId) guestIds.add(rg.guestId)
    }

    for (const guestId of guestIds) {
      await this.recomputeForGuest(guestId, trx)
    }
  }

  /**
   * Recompute summary fields (first/last reservation and arrival dates)
   * for a single guest. Considers both primary reservations and
   * reservations linked via the reservation_guests pivot table.
   */
  static async recomputeForGuest(
    guestId: number,
    trx?: TransactionClientContract
  ): Promise<void> {
    // Primary reservations for the guest
    const primaryReservations = await Reservation.query({ client: trx })
      .where('guest_id', guestId)

    // Reservations via pivot
    const pivotReservationIds = await ReservationGuest.query({ client: trx })
      .where('guest_id', guestId)
      .select('reservation_id')

    const ids = new Set<number>()
    for (const r of primaryReservations) ids.add(r.id)
    for (const pr of pivotReservationIds) ids.add(pr.reservationId)

    if (ids.size === 0) {
      // No reservations: clear summary
      const guest = await Guest.find(guestId, { client: trx })
      if (!guest) return
      guest.firstReservationId = null
      guest.lastReservationId = null
      guest.firstArrivalDate = null
      guest.lastArrivalDate = null
      await guest.useTransaction(trx).save()
      return
    }

    const allReservations = await Reservation.query({ client: trx })
      .whereIn('id', Array.from(ids))

    type ArrItem = { reservation: Reservation; arrival: DateTime | null }
    const arr: ArrItem[] = allReservations.map((r) => ({
      reservation: r,
      // Prefer actual arrival first, then check-in, then scheduled arrival
      arrival: r.arrivedDate ?? r.checkInDate ?? r.scheduledArrivalDate ?? null,
    }))

    const withArrival = arr.filter((a) => !!a.arrival)
    if (withArrival.length === 0) {
      // No usable arrival dates: clear summary
      const guest = await Guest.find(guestId, { client: trx })
      if (!guest) return
      guest.firstReservationId = null
      guest.lastReservationId = null
      guest.firstArrivalDate = null
      guest.lastArrivalDate = null
      await guest.useTransaction(trx).save()
      return
    }

    withArrival.sort((a, b) => (a.arrival!.toMillis() - b.arrival!.toMillis()))
    const first = withArrival[0]
    const last = withArrival[withArrival.length - 1]

    const guest = await Guest.find(guestId, { client: trx })
    if (!guest) return

    guest.firstReservationId = first.reservation.id
    guest.lastReservationId = last.reservation.id
    guest.firstArrivalDate = first.arrival
    guest.lastArrivalDate = last.arrival

    await guest.useTransaction(trx).save()
  }
}

export default GuestSummaryService