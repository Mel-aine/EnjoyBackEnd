/**
 * Tâche planifiée pour la synchronisation automatique des terminaux ZKTeco
 *
 * Cette tâche s'exécute automatiquement en arrière-plan pour:
 * - Synchroniser l'heure des terminaux
 * - Récupérer les logs d'accès
 * - Vérifier la connectivité
 */

import cron from 'node-cron'
import Door from '#models/door'
import ZkAccessService from '#services/zk_access_service'


export default class DoorSyncTask {
  private zkService: ZkAccessService
 private runningTasks = {
    logs: false,
    time: false,
    health: false,
  }

  constructor() {
    this.zkService = new ZkAccessService()
  }

  /**
   * Démarre toutes les tâches planifiées
   */
  public start() {
    console.log(' Démarrage des tâches de synchronisation des terminaux...')
    // Synchronisation des logs toutes les 30 minutes
    this.scheduleSyncLogs()
    // Synchronisation de l'heure toutes les heures
    this.scheduleSyncTime()
    //  Vérification de connectivité toutes les 6 heures
    this.scheduleHealthCheck()

    console.log('Tâches de synchronisation démarrées')
  }

  /**
   * Synchronise les logs d'accès toutes les 30 minutes
   */
  private scheduleSyncLogs() {
    // Exécution à la minute 0 de chaque heure
    cron.schedule('*/30 * * * *', async () => {
      if (this.runningTasks.logs) {
        console.log(' Synchronisation déjà en cours, tâche ignorée')
        return
      }

      this.runningTasks.logs = true
      console.log('Début de la synchronisation des logs...')

      try {
        const doors = await Door.query().where('is_active', true)

        let totalSynced = 0
        let errors = 0

        for (const door of doors) {
          try {
            const result = await this.zkService.syncLogs(door.id, false)

            if (result.success) {
              totalSynced += result.data?.newLogs || 0
              console.log(`${door.name}: ${result.data?.newLogs || 0} nouveaux logs`)
            } else {
              errors++
              console.error(`${door.name}: ${result.message}`)
            }
          } catch (error) {
            errors++
            console.error(` Erreur sur ${door.name}:`, error.message)
          }
        }

        console.log(
          `Synchronisation terminée: ${totalSynced} logs, ${errors} erreurs sur ${doors.length} terminaux`
        )
      } catch (error) {
        console.error('Erreur globale de synchronisation:', error)
      } finally {
        this.runningTasks.logs = false
      }
    })

    console.log('Tâche de synchronisation des logs: toutes les 30 minutes')
  }

  /**
   * Synchronise l'heure du système toutes les heures
   */
  private scheduleSyncTime() {
    // Exécution toutes les heures: "0 * * * *"
    cron.schedule('0 * * * *', async () => {
       if (this.runningTasks.time) {
        console.log('Synchronisation de l’heure déjà en cours, tâche ignorée')
        return
      }
      this.runningTasks.time = true

      try {
        const doors = await Door.query().where('is_active', true)

        let success = 0
        let errors = 0

        for (const door of doors) {
          try {
            const result = await this.zkService.syncTime(door.id)

            if (result.success) {
              success++
              console.log(`${door.name}: Heure synchronisée`)
            } else {
              errors++
              console.error(` ${door.name}: ${result.message}`)
            }
          } catch (error) {
            errors++
            console.error(` Erreur sur ${door.name}:`, error.message)
          }
        }

        console.log(`Synchronisation de l'heure terminée: ${success} succès, ${errors} erreurs`)
      } catch (error) {
        console.error('Erreur de synchronisation de l\'heure:', error)
      }finally {
        this.runningTasks.time = false
      }
    })

    console.log('Tâche de synchronisation de l\'heure: toutes les heures')
  }

  /**
   * Vérifie la connectivité des terminaux toutes les 6 heures
   */
  private scheduleHealthCheck() {
    // Exécution toutes les 6 heures: "0 */6 * * *"
    cron.schedule('0 */6 * * *', async () => {
       if (this.runningTasks.health) {
        console.log('Health check déjà en cours, tâche ignorée')
        return
      }

      this.runningTasks.health = true

      try {
        const doors = await Door.query().where('is_active', true)

        const offline = []
        const online = []

        for (const door of doors) {
          try {
            const result = await this.zkService.testConnection(door.id)

            if (result.success) {
              online.push(door.name)
              console.log(`${door.name}: En ligne`)
            } else {
              offline.push(door.name)
              console.error(` ${door.name}: Hors ligne`)
            }
          } catch (error) {
            offline.push(door.name)
            console.error(` Erreur sur ${door.name}: ${error.message}`)
          }
        }


        // Si trop de terminaux hors ligne, envoyer une alerte critique
        if (offline.length > doors.length / 2) {
          console.error(`ALERTE: ${offline.length}/${doors.length} terminaux hors ligne!`)
          // await this.sendCriticalAlert(offline)
        }
      } catch (error) {
        console.error('Erreur de vérification de santé:', error)
      }finally {
        this.runningTasks.health = false
      }
    })

    console.log(' Tâche de vérification de santé: toutes les 6 heures')
  }






}

