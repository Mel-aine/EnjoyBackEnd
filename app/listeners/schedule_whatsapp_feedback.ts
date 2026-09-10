import type ReservationCheckedOut from '#events/reservation_checked_out'
import WhatsappFeedbackMessage from '#models/whatsapp_feedback_message'
import Hotel from '#models/hotel'
import { DateTime } from 'luxon'

export default class ScheduleWhatsappFeedback {
async handle(event: ReservationCheckedOut) {
  const hotel = await Hotel.find(event.hotelId)
  if (!hotel || !hotel.whatsappFeedbackEnabled) return
  if (!event.recipientPhone) return
  if (!hotel.googlePlaceId) return

   // Anti-spam : pas de nouveau message si ce numéro a déjà été contacté
    // (ou a déjà un message planifié) au cours des 6 derniers mois
  const sixMonthsAgo = DateTime.now().minus({ months: 6 })

   const alreadyContacted = await WhatsappFeedbackMessage.query()
      .where('hotelId', event.hotelId)
      .where('guestPhone', event.recipientPhone)
      .where('createdAt', '>=', sixMonthsAgo.toSQL())
      .first()

    if (alreadyContacted) return

  const delayHours = hotel.whatsappFeedbackDelayHours ?? 2

  await WhatsappFeedbackMessage.create({
    reservationId: event.reservationId,
    hotelId: event.hotelId,
    guestId: event.guestId,
    guestName: event.recipientName,
    guestPhone: event.recipientPhone,
    status: 'pending',
    scheduledAt: DateTime.now().plus({ hours: delayHours }),
  })
}
}
