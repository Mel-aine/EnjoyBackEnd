import cron from 'node-cron'
import logger from '@adonisjs/core/services/logger'

let isRunning = false

cron.schedule('* * * * *', async () => {
  // Évite les exécutions simultanées
  if (isRunning) {
    logger.warn('[FeedbackSurvey] Cron déjà en cours, on skip')
    return
  }

  isRunning = true

  try {
    const { default: WhatsappScheduledMessage } = await import('#models/whatsapp_scheduled_message')
    const { default: WhatsAppNotificationService } = await import('#services/whatsapp_notification_service')
    const { DateTime } = await import('luxon')

    const pending = await WhatsappScheduledMessage.query()
      .where('status', 'pending')
      .where('templateName', 'feedback_surveys')
      .where('sendAfter', '<=', DateTime.now().toSQL())
      .limit(50)

    if (pending.length === 0) return

    logger.info(`[FeedbackSurvey] ${pending.length} message(s) à envoyer`)

    const svc = new WhatsAppNotificationService()

    // ✅ Envoi en parallèle au lieu de séquentiel
    await Promise.allSettled(
      pending.map(async (msg) => {
        try {
          const result = await svc.notifyFeedbackSurvey({
            hotelId: msg.hotelId,
            reservationId: msg.reservationId,
            recipientPhoneNumber: msg.recipientPhone,
            recipientName: msg.recipientName ?? '',
            hotelName: msg.hotelName,
            invoiceUrl: msg.invoiceUrl ?? '',
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
      })
    )
  } catch (err) {
    logger.error('[FeedbackSurvey] Erreur cron', err)
  } finally {
    // ✅ Toujours libérer le verrou, même en cas d'erreur
    isRunning = false
  }
})