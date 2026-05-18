import Hotel from '#models/hotel'
import Reservation from '#models/reservation'
import env from '#start/env'
import WhatsAppTrackingService from './whatsapp_tracking_service.js'
import WhatsappTemplateSyncService from './whatsapp_template_sync_service.js'
import HotelWhatsappTemplate from '#models/hotel_whatsapp_template'
import WhatsappLog from '#models/whatsapp_log'
import { DateTime } from 'luxon'

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

        const field = payload?.entry?.[0]?.changes?.[0]?.field

        // ──  Mise à jour statut template ────────────────────────────────────
        if (field === 'message_template_status_update') {
            const value = payload.entry[0].changes[0].value
            console.log(`Template status update: ${value.message_template_name} → ${value.message_template_status}`)

            const templateSyncService = new WhatsappTemplateSyncService()
            const templates = await HotelWhatsappTemplate.query()
                .where('template_name', value.message_template_name)

            for (const template of templates) {
                await templateSyncService.handleStatusWebhook({
                    hotelId: template.hotelId,
                    templateName: value.message_template_name,
                    status: value.message_template_status,
                    rejectionReason: value.reason ?? undefined,
                })
            }
            return
        }

        // ── 2. Statuts de livraison Meta (delivered / read / failed) ──────────
        const statuses = payload?.entry?.[0]?.changes?.[0]?.value?.statuses
        if (statuses?.length) {
            for (const statusEvent of statuses) {
                await this.processStatusEvent(statusEvent).catch((err) =>
                    console.error('[WhatsappWebhook] Erreur traitement status:', err)
                )
            }
            return
        }

        // ──  Message entrant ────────────────────────────────────────────────
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

        // ← Log du message entrant
        await this.logIncomingMessage(hotel.id, message).catch((err) =>
            console.error('[WhatsappWebhook] Erreur log message entrant:', err)
        )

        const trackingService = new WhatsAppTrackingService()
        await trackingService.track(hotel, message.from)

        await this.notifyPms(hotel, message)
        console.log('Traitement terminé')
    }

    // ── Statut de livraison ────────────────────────────────────────────────────

    private async processStatusEvent(event: {
        id: string
        status: string
        timestamp: string
        errors?: { code: number; title: string }[]
        pricing?: { price_per_message: number; currency: string }
    }): Promise<void> {
        const STATUS_MAP: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
            sent: 'sent',
            delivered: 'delivered',
            read: 'read',
            failed: 'failed',
        }

        const status = STATUS_MAP[event.status]
        if (!status || !event.id) {
            console.log(`[WhatsappWebhook] Status inconnu ou id manquant: ${event.status}`)
            return
        }

        const log = await WhatsappLog.findBy('meta_message_id', event.id)
        if (!log) {
            console.log(`[WhatsappWebhook] Aucun log trouvé pour meta_message_id=${event.id}`)
            return
        }

        const patch: Record<string, any> = { status }

        if (status === 'delivered') patch.deliveredAt = DateTime.now()
        if (status === 'read') patch.readAt = DateTime.now()
        if (status === 'failed') {
            patch.failedAt = DateTime.now()
            patch.failureReason = event.errors?.[0]?.title ?? 'unknown'
        }

        if (event.pricing?.price_per_message) {
            patch.cost = event.pricing.price_per_message
        }

        log.merge(patch)
        await log.save()

        console.log(`[WhatsappWebhook] Log ${event.id} → ${status}`)
    }

    // ── Message entrant ────────────────────────────────────────────────────────

    private async logIncomingMessage(
        hotelId: number,
        message: IncomingMessage
    ): Promise<void> {
        await WhatsappLog.create({
            hotelId,
            metaMessageId: message.messageId,
            status: 'received',
            recipientPhone: message.from,
            messageBody: message.text ?? null,
            provider: 'meta',
            sentAt: DateTime.fromSeconds(Number(message.timestamp)),
        })

        console.log(`[WhatsappWebhook] Message entrant loggé: ${message.messageId}`)
    }
}