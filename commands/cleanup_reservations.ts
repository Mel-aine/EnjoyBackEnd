import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Reservation from '#models/reservation'
import ReservationRoom from '#models/reservation_room'
import ReservationGuest from '#models/reservation_guest'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import FolioTransactionTax from '#models/folio_transaction_tax'

export default class CleanupReservations extends BaseCommand {
  public static commandName = 'cleanup:reservations'
  public static description = 'Delete all reservations (and related rooms, folios, transactions) for a hotel'
  public static options: CommandOptions = { startApp: true }

  public async run() {
    // Default to hotel 3 per request
    const HOTEL_ID = 3

    this.logger.info(`Starting cleanup for hotel ${HOTEL_ID}...`)

    // Fetch reservation IDs
    const reservations = await Reservation.query()
      .where('hotel_id', HOTEL_ID)
      .select('id')

    const reservationIds = reservations.map((r) => r.id)
    if (reservationIds.length === 0) {
      this.logger.warning(`No reservations found for hotel ${HOTEL_ID}. Nothing to delete.`)
      return
    }

    // Fetch reservation room IDs linked to these reservations
    const resRooms = await ReservationRoom.query()
      .whereIn('reservation_id', reservationIds)
      .select('id')
    const reservationRoomIds = resRooms.map((rr) => rr.id)

    // Fetch folio IDs by reservation_id or reservation_room_id
    const folios = await Folio.query()
      .where('hotel_id', HOTEL_ID)
      .where((q) => {
        q.whereIn('reservation_id', reservationIds)
         .orWhereIn('reservation_room_id', reservationRoomIds)
      })
      .select('id')
    const folioIds = folios.map((f) => f.id)

    // Fetch transaction IDs for these folios
    const transactions = folioIds.length > 0
      ? await FolioTransaction.query().whereIn('folio_id', folioIds).select('id')
      : []
    const transactionIds = transactions.map((t) => t.id)

    // Delete order: taxes -> transactions -> folios -> reservation guests -> reservation rooms -> reservations
    let taxesDeleted = 0
    if (transactionIds.length > 0) {
      taxesDeleted = await FolioTransactionTax.query()
        .whereIn('folio_transaction_id', transactionIds)
        .delete()
    }

    const transactionsDeleted = transactionIds.length > 0
      ? await FolioTransaction.query().whereIn('id', transactionIds).delete()
      : 0

    const foliosDeleted = folioIds.length > 0
      ? await Folio.query().whereIn('id', folioIds).delete()
      : 0

    const resGuestsDeleted = await ReservationGuest.query()
      .whereIn('reservation_id', reservationIds)
      .delete()

    const resRoomsDeleted = reservationRoomIds.length > 0
      ? await ReservationRoom.query().whereIn('id', reservationRoomIds).delete()
      : 0

    const reservationsDeleted = await Reservation.query()
      .whereIn('id', reservationIds)
      .delete()

    this.logger.success(
      `Cleanup complete for hotel ${HOTEL_ID}. ` +
      `Reservations: ${reservationsDeleted}, Rooms: ${resRoomsDeleted}, Guests: ${resGuestsDeleted}, ` +
      `Folios: ${foliosDeleted}, Transactions: ${transactionsDeleted}, Taxes: ${taxesDeleted}`
    )
  }
}