/**
 * Fichier de démarrage des tâches planifiées (Cron Jobs)
 */

import DoorSyncTask from '#app/tasks/sync_doors_task'
import Logger from '@adonisjs/core/services/logger'
import AccessExpirationTask from '#app/tasks/access_expiration_task'
import ScheduleQueueProcessing from '#app/tasks/schedule_queue'

export function startScheduledTasks() {
  try {
    Logger.info('Démarrage des tâches planifiées...')

    // Démarrer la tâche de synchronisation des terminaux ZKTeco
    const doorSyncTask = new DoorSyncTask()
    doorSyncTask.start()

    //demarrer la tâche de révocation des accès expirés
    const accessExpirationTask = new AccessExpirationTask()
    accessExpirationTask.start()

    // Ajouter d'autres tâches planifiées ici si nécessaire
    const scheduleQueueProcessing  = new ScheduleQueueProcessing()
    scheduleQueueProcessing.start()

    Logger.info('Toutes les tâches planifiées ont été démarrées avec succès')
  } catch (error) {
    Logger.error('Erreur lors du démarrage des tâches planifiées:', error)
  }
}
