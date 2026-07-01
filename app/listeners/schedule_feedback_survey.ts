

import type ReservationCheckedOut from '#events/reservation_checked_out'
import WhatsappScheduledMessage from '#models/whatsapp_scheduled_message'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'

export default class ScheduleFeedbackSurvey {
  async handle(event: ReservationCheckedOut) {
    try {
      if (!event.recipientPhone) {
        logger.warn('[FeedbackSurvey] Pas de téléphone, planification ignorée', {
          reservationId: event.reservationId,
        })
        return
      }

      await WhatsappScheduledMessage.create({
        hotelId: event.hotelId,
        reservationId: event.reservationId,
        guestId: event.guestId,
        templateName: 'feedback_surveys',
        recipientPhone: event.recipientPhone,
        recipientName: event.recipientName,
        hotelName: event.hotelName,
        invoiceUrl: event.invoiceUrl, 
        sendAfter: DateTime.now().plus({ hours: 2 }),
        // sendAfter: DateTime.now().plus({ minutes: 1 }),
        status: 'pending',
      })

      logger.info('[FeedbackSurvey] Planifié dans 2h', {
        reservationId: event.reservationId,
        phone: event.recipientPhone,
      })
    } catch (err) {
       logger.error('[FeedbackSurvey] Erreur planification', {
    message: err?.message,
    stack: err?.stack,
    reservationId: event.reservationId,
    event, // log tout l'event pour voir ce qui est null
  })
    }
  }
}