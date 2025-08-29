import type { HttpContext } from '@adonisjs/core/http'
import { EmailService } from '#services/email_service'
import { EmailQueueService } from '#services/email_queue_service'
import vine from '@vinejs/vine'

/**
 * Controller for testing email functionality
 */
export default class EmailTestController {
  /**
   * Test email configuration by sending a test email
   */
  async testConfiguration({ request, response }: HttpContext) {
    try {
      const validator = vine.compile(
        vine.object({
          email: vine.string().email(),
        })
      )

      const { email } = await request.validateUsing(validator)

      const result = await EmailService.testEmailConfiguration(email)

      if (result.success) {
        return response.ok({
          success: true,
          message: 'Test email sent successfully',
          data: result
        })
      } else {
        return response.badRequest({
          success: false,
          message: 'Failed to send test email',
          error: result.message
        })
      }
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    }
  }

  /**
   * Send a test email using a template
   */
  async testTemplate({ request, response }: HttpContext) {
    try {
      const validator = vine.compile(
        vine.object({
          templateName: vine.string(),
          email: vine.string().email(),
          data: vine.object({}).optional(),
        })
      )

      const { templateName, email, data = {} } = await request.validateUsing(validator)

      const result = await EmailService.sendTemplateEmail(templateName, email, data)

      if (result.success) {
        return response.ok({
          success: true,
          message: 'Template email sent successfully',
          data: result
        })
      } else {
        return response.badRequest({
          success: false,
          message: 'Failed to send template email',
          error: result.message
        })
      }
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    }
  }

  /**
   * Queue a test email for processing by the worker
   */
  async queueTestEmail({ request, response }: HttpContext) {
    try {
      const validator = vine.compile(
        vine.object({
          templateName: vine.string(),
          email: vine.string().email(),
          data: vine.object({}).optional(),
        })
      )

      const { templateName, email, data = {} } = await request.validateUsing(validator)

      const emailQueue = await EmailQueueService.queueEmail(templateName, email, data)

      return response.created({
        success: true,
        message: 'Email queued successfully for processing',
        data: {
          queueId: emailQueue.id,
          status: emailQueue.status,
          recipientEmail: emailQueue.recipientEmail,
          templateName: templateName
        }
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to queue email',
        error: error.message
      })
    }
  }

  /**
   * Get email service status and statistics
   */
  async getStatus({ response }: HttpContext) {
    try {
      const stats = await EmailQueueService.getQueueStats()
      
      return response.ok({
        success: true,
        message: 'Email service status retrieved successfully',
        data: {
          ...stats,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to get email service status',
        error: error.message
      })
    }
  }
}