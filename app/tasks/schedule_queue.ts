
import cron from 'node-cron'
import ZkIntegrationService from '#services/zk_integration_service'
import Logger from '@adonisjs/core/services/logger'

/**
 * Tâche planifiée pour traiter la file d'attente des opérations ZKTeco échouées
 *
 * Exécute les opérations en attente (grant/revoke) qui ont échoué lors du check-in/out
 * à cause d'un terminal hors ligne ou d'une erreur temporaire.
 */
export default class ScheduleQueueProcessing  {
  private zkIntegrationService: ZkIntegrationService
  private isRunning: boolean = false

  constructor() {
    this.zkIntegrationService = new ZkIntegrationService()
  }

/**
   * Démarre la tâche planifiée
   */
  public start() {
    Logger.info(' Démarrage du worker de file d\'attente ZKTeco...')
    this.scheduleQueueProcessing()
    Logger.info(' Worker de file d\'attente ZKTeco démarré')
  }

  /**
   * Traite la queue toutes les 5 minutes
   */
  private scheduleQueueProcessing() {
    // Exécution toutes les 5 minutes: "*/5 * * * *"
    cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        Logger.debug('[Queue Worker] Traitement déjà en cours, tâche ignorée')
        return
      }

      this.isRunning = true
      Logger.info('[Queue Worker] Début du traitement de la file d\'attente...')

      try {
        const result = await this.zkIntegrationService.processQueue()

        if (result.processed > 0) {
          Logger.info(
            `[Queue Worker]  Traitement terminé: ` +
            `${result.succeeded} succès, ${result.failed} échecs, ` +
            `${result.remaining} tâches restantes`
          )
        } else {
          Logger.debug('[Queue Worker] Aucune tâche en attente')
        }

        // Alerter si trop de tâches échouées s'accumulent
        if (result.remaining > 100) {
          Logger.warn(
            `[Queue Worker]  ATTENTION: ${result.remaining} tâches en attente dans la queue. ` +
            `Vérifier la connectivité des terminaux.`
          )
        }

      } catch (error) {
        Logger.error('[Queue Worker]  Erreur lors du traitement de la queue:', error)
      } finally {
        this.isRunning = false
      }
    })

    Logger.info(' Tâche de traitement de la queue: toutes les 5 minutes')
  }
}
