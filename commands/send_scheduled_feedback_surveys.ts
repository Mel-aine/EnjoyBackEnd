
import { BaseCommand } from '@adonisjs/core/ace'
import WhatsappScheduledMessage from '#models/whatsapp_scheduled_message'
import WhatsAppNotificationService from '#services/whatsapp_notification_service'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'

export default class SendScheduledFeedbackSurveys extends BaseCommand {
  static commandName = 'auto:send-feedback-surveys'
  static description = 'Envoie les feedback surveys WhatsApp planifiés'

  async run() {
    const pending = await WhatsappScheduledMessage.query()
      .where('status', 'pending')
      .where('templateName', 'feedback_survey')
      .where('sendAfter', '<=', DateTime.now().toSQL())
      .limit(50) // sécurité anti-flood

    if (pending.length === 0) return

    this.logger.info(`[FeedbackSurvey] ${pending.length} message(s) à envoyer`)

    const svc = new WhatsAppNotificationService()

    for (const msg of pending) {
      try {
        const result = await svc.notifyFeedbackSurvey({
          hotelId: msg.hotelId,
          reservationId: msg.reservationId,
          recipientPhoneNumber: msg.recipientPhone,
          recipientName: msg.recipientName ?? '',
          hotelName: msg.hotelName,
        })

        msg.status = result.delivered ? 'sent' : 'failed'
        msg.sentAt = result.delivered ? DateTime.now() : null
        msg.failureReason = result.delivered ? null : (result.reason ?? 'unknown')
        await msg.save()

        logger.info('[FeedbackSurvey] Envoyé', {
          id: msg.id,
          phone: msg.recipientPhone,
          delivered: result.delivered,
        })
      } catch (err: any) {
        msg.status = 'failed'
        msg.failureReason = err?.message ?? 'exception'
        await msg.save()
        logger.error('[FeedbackSurvey] Erreur envoi', { id: msg.id, err })
      }
    }
  }
}