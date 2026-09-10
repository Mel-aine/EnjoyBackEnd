import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import WhatsappFeedbackMessage from '#models/whatsapp_feedback_message'
import Hotel from '#models/hotel'
import WhatsappFeedbackService from '#services/whatsapp_feedback_service'

export default class WhatsappFeedbackMessagesController {

  async pendingForHotel({ params, response }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.hotelId)

      const messages = await WhatsappFeedbackMessage.query()
        .where('hotelId', hotel.id)
        .where('status', 'pending')
        .where('scheduledAt', '<=', DateTime.now().toSQL())
        .preload('reservation', (resQuery) => {
          resQuery.preload('reservationRooms', (rrQuery) => {
            rrQuery.preload('room')
          })
        })
        .orderBy('scheduledAt', 'asc')

      const data = messages.map((msg) => {
        const { waLink } = WhatsappFeedbackService.generate({
          guestName: msg.guestName,
          guestPhone: msg.guestPhone,
          hotelName: hotel.hotelName,
          googlePlaceId: hotel.googlePlaceId ?? '',
        })

        const roomNumbers = (msg.reservation?.reservationRooms || [])
          .map((rr) => rr.room?.roomNumber)
          .filter(Boolean)
          .join(', ')

        return {
          id: msg.id,
          guestName: msg.guestName,
          guestPhone: msg.guestPhone,
          reservationId: msg.reservationId,
          reservationNumber: msg.reservation?.reservationNumber ?? null,
          roomNumbers: roomNumbers || null,
          waLink,
        }
      })

      return response.ok({ data })
    } catch (error) {
      console.error('Error fetching pending WhatsApp feedback messages:', error)
      return response.status(500).json({ success: false, message: error.message })
    }
  }

  async pendingForReservation({ params, response }: HttpContext) {
    try {
      const msg = await WhatsappFeedbackMessage.query()
        .where('reservationId', params.reservationId)
        .where('status', 'pending')
        .where('scheduledAt', '<=', DateTime.now().toSQL())
        .first()

      if (!msg) return response.ok({ data: null })

      const hotel = await Hotel.findOrFail(msg.hotelId)

      const { waLink } = WhatsappFeedbackService.generate({
        guestName: msg.guestName,
        guestPhone: msg.guestPhone,
        hotelName: hotel.hotelName,
        googlePlaceId: hotel.googlePlaceId ?? '',
      })

      return response.ok({ data: { id: msg.id, guestName: msg.guestName, waLink } })
    } catch (error) {
      console.error('Error fetching reservation WhatsApp feedback:', error)
      return response.status(500).json({ success: false, message: error.message })
    }
  }

  async markSent({ params, auth, response }: HttpContext) {
    try {
      const msg = await WhatsappFeedbackMessage.findOrFail(params.id)
      msg.status = 'sent'
      msg.sentAt = DateTime.now()
      msg.sentBy = auth.user!.id
      await msg.save()
      return response.ok({ success: true })
    } catch (error) {
      console.error('Error marking WhatsApp feedback as sent:', error)
      return response.status(500).json({ success: false, message: error.message })
    }
  }
}
