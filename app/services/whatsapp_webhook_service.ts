import Hotel from '#models/hotel'
import Reservation from '#models/reservation'
import env from '#start/env'
import WhatsAppTrackingService from './whatsapp_tracking_service.js'

interface IncomingMessage {
  phoneNumberId: string
  from: string
  messageId: string
  type: string
  text?: string
  timestamp: string
}

export default class WhatsAppWebhookService {

  private parsePayload(payload: any): IncomingMessage | null {
    try {
      const entry = payload?.entry?.[0]
      const change = entry?.changes?.[0]
      const value = change?.value

      const phoneNumberId = value?.metadata?.phone_number_id
      const message = value?.messages?.[0]

      console.log(' parsePayload - phoneNumberId:', phoneNumberId)
      console.log(' parsePayload - message:', JSON.stringify(message, null, 2))

      if (!phoneNumberId || !message) {
        console.log(' parsePayload - phoneNumberId ou message manquant')
        return null
      }

      return {
        phoneNumberId,
        from: message.from,
        messageId: message.id,
        type: message.type,
        text: message.text?.body ?? null,
        timestamp: message.timestamp,
      }
    } catch (err) {
      console.log(' parsePayload - erreur:', err)
      return null
    }
  }

  private async resolveHotelByGuestPhone(phone: string): Promise<Hotel | null> {
    const normalizedPhone = phone.replace(/^\+/, '')
    console.log(' resolveHotelByGuestPhone - numéro normalisé:', normalizedPhone)

    //  séjour en cours
    let booking = await Reservation.query()
      .whereHas('guest', (q) => {
        q.where('phone_secondary', normalizedPhone)
          .orWhere('phone_secondary', `+${normalizedPhone}`)
      })
      .where('status', 'checked_in')
      .preload('hotel')
      .orderBy('created_at', 'desc')
      .first()

    if (booking) {
      console.log(` Séjour actif trouvé: reservation_id=${booking.id}, hotel_id=${booking.hotel.id}`)
    } else {
      console.log(' Aucun séjour actif → fallback sur réservation la plus récente')

      //  réservation la plus récente
      booking = await Reservation.query()
        .whereHas('guest', (q) => {
          q.where('phone_secondary', normalizedPhone)
            .orWhere('phone_secondary', `+${normalizedPhone}`)
        })
        .preload('hotel')
        .orderBy('created_at', 'desc')
        .first()

      if (booking) {
        console.log(` Réservation récente trouvée: reservation_id=${booking.id}, status=${booking.status}, hotel_id=${booking.hotel.id}`)
      }
    }

    if (!booking?.hotel) {
      console.log(` Aucune réservation trouvée pour le numéro: ${phone}`)
      return null
    }

    return booking.hotel
  }

  // ← signature corrigée : reçoit aussi fromPhone
  private async resolveHotel(phoneNumberId: string, fromPhone: string): Promise<Hotel | null> {
    console.log(' resolveHotel - phoneNumberId:', phoneNumberId)

    const managedPhoneId = env.get('WHATSAPP_MANAGED_PHONE_ID', '')
    console.log(' resolveHotel - managedPhoneId:', managedPhoneId)

    // Cas platform : même phone_number_id pour tous les hôtels platform
    if (managedPhoneId && phoneNumberId === managedPhoneId) {
      console.log(' phone_number_id = Managed API → résolution par numéro client')
      return this.resolveHotelByGuestPhone(fromPhone)
    }

    // Cas meta propre : chercher l'hôtel qui a ce phone_number_id
    const hotels = await Hotel.query().where('whatsapp_enabled', true)
    console.log(` ${hotels.length} hôtel(s) WhatsApp actif(s) trouvé(s)`)

    const hotel = hotels.find(h => {
      const config = h.whatsappConfig as Record<string, any> | null
      return config?.phone_number_id === phoneNumberId
    }) ?? null

    if (hotel) {
      console.log(` Hôtel résolu via phone_number_id: hotel_id=${hotel.id}`)
    } else {
      console.log(` Aucun hôtel trouvé pour phone_number_id: ${phoneNumberId}`)
    }

    return hotel
  }

  private async notifyPms(hotel: Hotel, message: IncomingMessage): Promise<void> {
    console.log(`Hotel [${hotel.id}] - Nouveau message WhatsApp`)
    console.log(` De: ${message.from}`)
    console.log(` Message: ${message.text}`)
    console.log(` Timestamp: ${message.timestamp}`)

    // await Event.emit('whatsapp:message:received', { hotel, message })
  }

  async process(payload: any): Promise<void> {
    console.log('Webhook reçu - début du traitement')

    const isStatusUpdate = payload?.entry?.[0]?.changes?.[0]?.value?.statuses
    if (isStatusUpdate) {
      console.log(' Status update ignoré')
      return
    }

    const message = this.parsePayload(payload)
    if (!message) {
      console.log(' Payload non parseable ou vide')
      return
    }

    console.log(` Message de ${message.from} - type: ${message.type} - text: ${message.text}`)

    const hotel = await this.resolveHotel(message.phoneNumberId, message.from)
    if (!hotel) {
      console.log(' Hôtel non résolu - message ignoré')
      return
    }
     const trackingService = new WhatsAppTrackingService()
     await trackingService.track(hotel, message.from)
 

    await this.notifyPms(hotel, message)
    console.log('Traitement terminé')
  }
}