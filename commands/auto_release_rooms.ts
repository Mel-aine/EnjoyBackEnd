// import { BaseCommand } from '@adonisjs/core/ace'
// import type { CommandOptions } from '@adonisjs/core/types/ace'

// export default class AutoReleaseRooms extends BaseCommand {
//   static commandName = 'auto:release-rooms'
//   static description = ''

//   static options: CommandOptions = {}

//   async run() {
//     this.logger.info('Hello world from "AutoReleaseRooms"')
//   }
// }
import { BaseCommand } from '@adonisjs/core/ace'
import ReservationServiceProduct from '#models/reservation_service_product'
import { DateTime } from 'luxon'

export default class AutoReleaseRooms extends BaseCommand {
  public static commandName = 'auto:release-rooms'
  public static description = 'Libère automatiquement les chambres dont la date de départ est dépassée'

  public async run() {
    this.logger.info('Début de la libération automatique des chambres...')

    try {
      const now = DateTime.local().toSQL() // format compatible avec SQL DATETIME

      // Recherche les réservations terminées dont la chambre n'est pas encore disponible
      const expiredReservations = await ReservationServiceProduct.query()
        .where('end_date', '<', now)
        .preload('serviceProduct')

      this.logger.info(`Nombre de réservations expirées à traiter : ${expiredReservations.length}`)

      for (const reservation of expiredReservations) {
        if (!reservation.serviceProduct) {
          this.logger.warn(`ServiceProduct non trouvé pour réservation ${reservation.id}`)
          continue
        }

        if (reservation.serviceProduct.status !== 'available') {
          reservation.serviceProduct.status = 'available'
          await reservation.serviceProduct.save()
          this.logger.info(`Chambre ${reservation.serviceProduct.id} libérée`)
        } else {
          this.logger.info(`Chambre ${reservation.serviceProduct.id} déjà disponible`)
        }
      }

      this.logger.info('Libération automatique terminée avec succès.')
    } catch (error) {
      this.logger.error('Erreur pendant la libération automatique:', error)
    }
  }
}
