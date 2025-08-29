import type { HttpContext } from '@adonisjs/core/http'
import EmailQueueService, { QueueEmailData } from '#services/email_queue_service'
import EmailQueue from '#models/email_queue'
import { queueEmailValidator } from '#validators/email_queue'

export default class EmailQueueController {
  /**
   * Ajouter un email à la file d'attente
   */
  async queueEmail({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(queueEmailValidator)
      
      const queueItem = await EmailQueueService.queueEmail(payload as QueueEmailData)
      
      return response.created({
        success: true,
        message: 'Email queued successfully',
        data: queueItem
      })
    } catch (error) {
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          success: false,
          message: 'Validation failed',
          errors: error.messages
        })
      }
      
      return response.internalServerError({
        success: false,
        message: 'Error queuing email',
        error: error.message
      })
    }
  }

  /**
   * Récupérer le statut de la file d'attente
   */
  async getQueueStatus({ response }: HttpContext) {
    try {
      const [pending, processing, sent, failed] = await Promise.all([
        EmailQueue.query().where('status', 'pending').count('* as total'),
        EmailQueue.query().where('status', 'processing').count('* as total'),
        EmailQueue.query().where('status', 'sent').count('* as total'),
        EmailQueue.query().where('status', 'failed').count('* as total')
      ])

      return response.ok({
        success: true,
        data: {
          pending: pending[0].$extras.total,
          processing: processing[0].$extras.total,
          sent: sent[0].$extras.total,
          failed: failed[0].$extras.total
        }
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error fetching queue status',
        error: error.message
      })
    }
  }

  /**
   * Récupérer l'historique des emails
   */
  async getEmailHistory({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status')

      const query = EmailQueue.query()
        .preload('emailTemplate')
        .preload('emailLogs')
        .orderBy('created_at', 'desc')

      if (status) {
        query.where('status', status)
      }

      const emails = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: emails
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error fetching email history',
        error: error.message
      })
    }
  }

  /**
   * Relancer un email échoué
   */
  async retryFailedEmail({ params, response }: HttpContext) {
    try {
      const emailQueue = await EmailQueue.findOrFail(params.id)
      
      if (emailQueue.status !== 'failed') {
        return response.badRequest({
          success: false,
          message: 'Only failed emails can be retried'
        })
      }

      emailQueue.status = 'pending'
      emailQueue.retryCount = 0
      await emailQueue.save()

      return response.ok({
        success: true,
        message: 'Email queued for retry',
        data: emailQueue
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Email not found'
        })
      }
      
      return response.internalServerError({
        success: false,
        message: 'Error retrying email',
        error: error.message
      })
    }
  }
}