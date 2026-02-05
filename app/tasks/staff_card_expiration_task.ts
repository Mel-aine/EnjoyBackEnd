// app/tasks/staff_card_expiration_task.ts

import cron from 'node-cron'
import StaffAccessCard from '#models/staff_access_card'
import StaffAccessCardService from '#services/staff_access_card_service'
import { DateTime } from 'luxon'
import Logger from '@adonisjs/core/services/logger'

export default class StaffCardExpirationTask {
  private staffCardService: StaffAccessCardService

  constructor() {
    this.staffCardService = new StaffAccessCardService()
  }

  public start() {
    Logger.info('Démarrage vérification expiration badges staff...')
    this.scheduleExpiration()
  }

  private scheduleExpiration() {
    // Toutes les heures
    cron.schedule('0 * * * *', async () => {
      Logger.info('[StaffCardExpiration] Vérification badges expirés...')

      try {
        const now = DateTime.now()

        const expiredCards = await StaffAccessCard.query()
          .where('status', 'active')
          .whereNotNull('valid_until')
          .where('valid_until', '<', now.toSQL())

        if (expiredCards.length === 0) {
          Logger.debug('[StaffCardExpiration]  Aucun badge expiré')
          return
        }

        Logger.warn(`[StaffCardExpiration] ${expiredCards.length} badge(s) expiré(s)`)

        for (const card of expiredCards) {
          await this.staffCardService.revokeCard(
            card.id,
            0, // Système
            'Expiration automatique'
          )

          Logger.info(`[StaffCardExpiration]  Badge #${card.id} révoqué (expiré)`)
        }
      } catch (error) {
        Logger.error('[StaffCardExpiration]  Erreur:', error)
      }
    })
  }
}
