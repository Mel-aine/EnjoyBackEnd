import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Reservation from '#models/reservation'
import ReservationRoom from '#models/reservation_room'

export default class FixReservationRoomStatus extends BaseCommand {
  public static commandName = 'fix:reservation-room-status'
  public static description =
    "Met à jour le statut des reservation_rooms à 'checked_out' pour toutes les réservations checkout d'un hôtel"

  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: "ID de l'hôtel", alias: 'h' })
  declare hotelId: number | undefined

  @flags.boolean({
    description: 'Mode dry-run : affiche ce qui serait fait sans exécuter',
    alias: 'd',
  })
  declare dryRun: boolean | undefined

  public async run() {
    const hotelId = Number(this.hotelId ?? 47)

    if (!Number.isFinite(hotelId) || hotelId <= 0) {
      this.logger.error('Invalid hotel ID. Use --hotel-id or -h to specify.')
      return
    }

    const isDryRun = this.dryRun ?? false

    this.logger.info(
      `Recherche des réservations checkout pour l'hôtel ${hotelId}...`
    )

    // 1. Trouver toutes les réservations avec statut 'checked_out'
    const reservations = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('status', 'checked_out')
      .select('id', 'reservation_number', 'reservation_status', 'status')

    if (reservations.length === 0) {
      this.logger.warning(
        `Aucune réservation checkout trouvée pour l'hôtel ${hotelId}.`
      )
      return
    }

    this.logger.info(
      `✅ ${reservations.length} réservation(s) checkout trouvée(s).`
    )

    const reservationIds = reservations.map((r) => r.id)

    // 2. Trouver les reservation_rooms liées qui ne sont PAS encore 'checked_out'
    const resRooms = await ReservationRoom.query()
      .whereIn('reservation_id', reservationIds)
      .whereNot('status', 'checked_out')
      .select('id', 'reservation_id', 'status', 'room_id')

    if (resRooms.length === 0) {
      this.logger.success(
        `✅ Toutes les reservation_rooms sont déjà en statut 'checked_out' pour l'hôtel ${hotelId}.`
      )
      return
    }

    this.logger.info(
      `🔍 ${resRooms.length} reservation_room(s) à mettre à jour trouvée(s) :`
    )

    // Afficher un récapitulatif
    for (const rr of resRooms) {
      const res = reservations.find((r) => r.id === rr.reservationId)
      this.logger.info(
        `   - ReservationRoom #${rr.id} (Réservation #${res?.reservationNumber ?? rr.reservationId}) : ${rr.status} → checked_out`
      )
    }

    // 3. Mettre à jour les statuts (sauf en dry-run)
    if (isDryRun) {
      this.logger.warning('⚠️  Dry-run activé : aucune modification effectuée.')
      return
    }

    const updated = await ReservationRoom.query()
      .whereIn('id', resRooms.map((rr) => rr.id))
      .update({ status: 'checked_out' as const })

    this.logger.success(
      `✅ ${updated} reservation_room(s) mise(s) à jour avec le statut 'checked_out' pour l'hôtel ${hotelId}.`
    )
  }
}
