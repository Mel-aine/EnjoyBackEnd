import ZkIntegrationService from '#services/zk_integration_service'
import RetryQueue from '#models/retry_queue'
import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

/**
 * Tâche planifiée pour traiter la file d'attente des opérations ZKTeco échouées
 *
 * Exécute les opérations en attente (grant/revoke) qui ont échoué lors du check-in/out
 * à cause d'un terminal hors ligne ou d'une erreur temporaire.
 */
export default class AccessControlQueueWorker {
  private zkIntegrationService: ZkIntegrationService
  constructor() {
    this.zkIntegrationService = new ZkIntegrationService()
  }


  /**
   * Affiche le statut de la file d'attente
   *
   * GET /api/queue/status
   */
  public async queueStatus({ response }: HttpContext) {
    try {
      const pending = await RetryQueue.query()
        .where('status', 'pending')
        .count('* as total')

      const processing = await RetryQueue.query()
        .where('status', 'processing')
        .count('* as total')

      const failed = await RetryQueue.query()
        .where('status', 'failed')
        .count('* as total')

      const completed = await RetryQueue.query()
        .where('status', 'completed')
        .count('* as total')

      // Statistiques sur les retry
      const highRetryCount = await RetryQueue.query()
        .where('status', 'pending')
        .where('retry_count', '>=', 3)
        .count('* as total')

      return response.ok({
        success: true,
        data: {
          pending: Number(pending[0].$extras.total),
          processing: Number(processing[0].$extras.total),
          failed: Number(failed[0].$extras.total),
          completed: Number(completed[0].$extras.total),
          highRetryCount: Number(highRetryCount[0].$extras.total),
        },
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error retrieving queue status',
        error: error.message,
      })
    }
  }

  /**
   * Liste les tâches en attente dans la queue
   *
   * GET /api/queue/pending
   */
  public async queuePending({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = request.input('per_page', 20)

      const tasks = await RetryQueue.query()
        .where('status', 'pending')
        .preload('door')
        .orderBy('retry_count', 'desc')
        .orderBy('created_at', 'asc')
        .paginate(page, perPage)

      return response.ok({
        success: true,
        data: tasks,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error retrieving pending tasks',
        error: error.message,
      })
    }
  }

  /**
   * Liste les tâches échouées
   *
   * GET /api/queue/failed
   */
  public async queueFailed({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = request.input('per_page', 20)

      const tasks = await RetryQueue.query()
        .where('status', 'failed')
        .preload('door')
        .orderBy('updated_at', 'desc')
        .paginate(page, perPage)

      return response.ok({
        success: true,
        data: tasks,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error retrieving failed tasks',
        error: error.message,
      })
    }
  }

  /**
   * Relance manuellement une tâche échouée
   *
   * POST /api/queue/:id/retry
   */
  public async retryTask({ params, response }: HttpContext) {
    try {
      const task = await RetryQueue.findOrFail(params.id)

      if (task.status === 'completed') {
        return response.badRequest({
          success: false,
          message: 'Cannot retry a completed task',
        })
      }

      // Réinitialiser la tâche
      task.status = 'pending'
      task.retryCount = 0
      task.errorMessage = null
      task.lastError = null
      await task.save()

      return response.ok({
        success: true,
        message: 'Task reset and queued for retry',
        data: task,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error retrying task',
        error: error.message,
      })
    }
  }

  /**
   * Supprime une tâche de la queue
   *
   * DELETE /api/queue/:id
   */
  public async deleteTask({ params, response }: HttpContext) {
    try {
      const task = await RetryQueue.findOrFail(params.id)
      await task.delete()

      return response.ok({
        success: true,
        message: 'Task deleted successfully',
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error deleting task',
        error: error.message,
      })
    }
  }

  /**
   * Nettoie les tâches complétées anciennes (> 30 jours)
   *
   * DELETE /api/queue/cleanup
   */
  public async cleanupCompleted({ response }: HttpContext) {
    try {
      const thirtyDaysAgo = DateTime.now().minus({ days: 30 })

      const deleted = await RetryQueue.query()
        .where('status', 'completed')
        .where('updated_at', '<', thirtyDaysAgo.toSQL())
        .delete()

      return response.ok({
        success: true,
        message: `${deleted} completed tasks deleted`,
        data: { deletedCount: deleted },
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error cleaning up tasks',
        error: error.message,
      })
    }
  }

  /**
   * Force le traitement immédiat de la queue (manuel)
   *
   * POST /api/queue/process-now
   */
  public async processQueueNow({ response }: HttpContext) {
    try {
      const result = await this.zkIntegrationService.processQueue()

      return response.ok({
        success: true,
        message: 'Queue processing completed',
        data: result,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error processing queue',
        error: error.message,
      })
    }
  }

  /**
 * Relancer les tâches d’un terminal spécifique
 *
 */
public async retryTerminalQueue({ params, response }: HttpContext) {
  try {
    const result = await this.zkIntegrationService.processQueueForDoor(
    params.id
  )
  return response.ok({
    success: true,
    message: 'Terminal queue processed',
    data: result,
  })

  } catch (error) {
    return response.internalServerError({
        success: false,
        message: 'Error processing queue',
        error: error.message,
    })
  }

}
}
