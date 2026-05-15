import Hotel from '#models/hotel'
import env from '#start/env'

const MANAGED_API_CONFIG = {
    provider: 'meta',
    api_base_url: env.get('WHATSAPP_MANAGED_BASE_URL', 'https://graph.facebook.com'),
    api_version: env.get('WHATSAPP_MANAGED_VERSION', 'v25.0'),
    phone_number_id: env.get('WHATSAPP_MANAGED_PHONE_ID', ''),
    business_account_id: env.get('WHATSAPP_MANAGED_WABA_ID', ''),
    access_token: env.get('WHATSAPP_MANAGED_TOKEN', ''),
    sender_name: env.get('WHATSAPP_MANAGED_SENDER_NAME', 'Enjoy-Stay'),
}

type WhatsAppConfig = Record<string, any>

export default class WhatsAppNotificationService {
    private redactConfig(config: WhatsAppConfig) {
        if (!config || typeof config !== 'object') return {}

        const clone: Record<string, any> = { ...config }
        delete clone.access_token
        delete clone.accessToken
        delete clone.token
        delete clone.bearer_token
        delete clone.bearerToken

        return clone
    }

    private normalizePhoneNumber(value: unknown) {
        const raw = String(value ?? '').trim()
        if (!raw) return null

        // Retire tout sauf les chiffres — Meta veut 237XXXXXXXXX sans +
        const digits = raw.replace(/[^\d]/g, '')
        if (!digits) return null

        return digits
    }

    private buildMessage(input: {
        recipientName?: string | null
        serviceName: string
        amountFcfa: string
        bookingTotalFcfa: string
    }) {
        const greeting = input.recipientName ? `Bonjour ${input.recipientName}, ` : 'Bonjour, '
        return `${greeting}le service ${input.serviceName} a ete ajoute a votre sejour. Montant: ${input.amountFcfa}. Nouveau total a payer: ${input.bookingTotalFcfa}.`
    }

    private buildMetaEndpoint(config: WhatsAppConfig) {
        const explicitEndpoint = String(config.endpoint_url ?? '').trim()
        if (explicitEndpoint) return explicitEndpoint

        const apiBaseUrl = String(config.api_base_url ?? 'https://graph.facebook.com').replace(/\/+$/, '')
        const apiVersion = String(config.api_version ?? 'v21.0').trim().replace(/^\/+/, '')
        const phoneNumberId = String(config.phone_number_id ?? '').trim()

        if (!phoneNumberId) return null

        return `${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`
    }

    private async deliverMetaTextMessage(input: {
        message: string
        recipientPhoneNumber: string
        config: WhatsAppConfig
    }) {
        const accessToken = String(
            input.config.access_token ?? input.config.token ?? input.config.bearer_token ?? ''
        ).trim()
        const endpoint = this.buildMetaEndpoint(input.config)

        if (!accessToken) {
            return {
                delivered: false,
                channel: 'whatsapp-meta',
                provider: 'meta',
                reason: 'missing_access_token',
                message: input.message,
                config: this.redactConfig(input.config),
            }
        }

        if (!endpoint) {
            return {
                delivered: false,
                channel: 'whatsapp-meta',
                provider: 'meta',
                reason: 'missing_phone_number_id',
                message: input.message,
                config: this.redactConfig(input.config),
            }
        }

        // Valider l'URL avant fetch
        try {
            new URL(endpoint)
        } catch {
            return {
                delivered: false,
                channel: 'whatsapp-meta',
                provider: 'meta',
                reason: 'invalid_endpoint_url',
                endpoint,
                message: input.message,
                config: this.redactConfig(input.config),
            }
        }


        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: input.recipientPhoneNumber,
                type: 'text',
                text: {
                    preview_url: false,
                    body: input.message,
                },
            }),
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
            return {
                delivered: false,
                channel: 'whatsapp-meta',
                provider: 'meta',
                reason: 'provider_request_failed',
                status: response.status,
                message: input.message,
                recipient_phone_number: input.recipientPhoneNumber,
                config: this.redactConfig(input.config),
                provider_response: data,
            }
        }

        return {
            delivered: true,
            channel: 'whatsapp-meta',
            provider: 'meta',
            message: input.message,
            recipient_phone_number: input.recipientPhoneNumber,
            config: this.redactConfig(input.config),
            provider_response: data,
        }
    }

    private buildReservationMessage(input: {
        recipientName?: string | null
        reservationNumber: string
        roomType: string
        checkInDate: string
        checkOutDate: string
        hotelName: string
    }) {
        const greeting = input.recipientName ? `Bonjour ${input.recipientName}, ` : 'Bonjour, '
        return `${greeting}votre reservation N°${input.reservationNumber} au ${input.hotelName} est confirmee. Chambre: ${input.roomType}. Arrivee: ${input.checkInDate}. Depart: ${input.checkOutDate}. Merci de votre confiance.`
    }

    private buildCheckInMessage(input: {
        recipientName?: string | null
        roomNumber: string
        hotelName: string
        checkOutDate: string
    }) {
        const greeting = input.recipientName ? `Bonjour ${input.recipientName}, ` : 'Bonjour, '
        return `${greeting}bienvenue au ${input.hotelName} ! Votre check-in est confirme. Chambre: ${input.roomNumber}. Depart prevu: ${input.checkOutDate}. Bon sejour !`
    }

    private buildRoomPostingMessage(input: {
        recipientName?: string | null
        serviceName: string
        amountFcfa: string
        bookingTotalFcfa: string
    }) {
        const greeting = input.recipientName ? `Bonjour ${input.recipientName}, ` : 'Bonjour, '
        return `${greeting}le service "${input.serviceName}" a ete ajoute a votre sejour. Montant: ${input.amountFcfa} FCFA. Total a payer: ${input.bookingTotalFcfa} FCFA.`
    }

    private buildCheckOutMessage(input: {
        recipientName?: string | null
        hotelName: string
        totalFcfa: string
        reservationNumber: string
    }) {
        const greeting = input.recipientName ? `Bonjour ${input.recipientName}, ` : 'Bonjour, '
        return `${greeting}merci d\'avoir sejourne au ${input.hotelName}. Votre check-out pour la reservation N°${input.reservationNumber} est confirme. Total facture: ${input.totalFcfa} FCFA. Au plaisir de vous revoir !`
    }



    private async resolveSettings(hotelId: number | null | undefined) {
        if (!hotelId) return { enabled: false, config: {}, reason: 'missing_hotel_id' }

        const hotel = await Hotel.find(hotelId)
        if (!hotel) return { enabled: false, config: {}, reason: 'hotel_not_found' }
        if (!hotel.whatsappEnabled) return { enabled: false, config: {}, reason: 'whatsapp_disabled_in_hotel' }

        if (hotel.whatsappProviderType === 'platform') {
            return {
                enabled: true,
                config: MANAGED_API_CONFIG,
                reason: null,
                credentialSource: 'managed_api',
            }
        }

        return {
            enabled: true,
            config: { ...hotel.whatsappConfig, provider: hotel.whatsappProviderType },
            reason: null,
            credentialSource: 'hotel_own',
        }
    }

    private async deliver(input: {
        settings: { enabled: boolean; config: WhatsAppConfig; reason: string | null }
        recipientPhoneNumber?: string | null
        message: string
        configOverride?: WhatsAppConfig | null
    }) {
        const hasConfigOverride = Boolean(
            input.configOverride && Object.keys(input.configOverride).length
        )
        let settings = hasConfigOverride
            ? { enabled: true, config: input.configOverride ?? {}, reason: null }
            : input.settings

        if (settings.config.provider === 'platform') {
            settings = { enabled: true, config: MANAGED_API_CONFIG, reason: null }
        }

        const config = settings.config ?? {}
        const recipientPhoneNumber = this.normalizePhoneNumber(
            input.recipientPhoneNumber ?? config.recipient_phone_number ?? config.to
        )

        if (!settings.enabled) {
            return {
                delivered: false,
                channel: 'whatsapp-disabled',
                reason: settings.reason,
                message: input.message,
                config: this.redactConfig(config),
            }
        }

        if (!recipientPhoneNumber) {
            return {
                delivered: false,
                channel: 'whatsapp-disabled',
                reason: 'missing_recipient_phone_number',
                message: input.message,
                config: this.redactConfig(config),
            }
        }

        const provider = String(config.provider ?? 'meta').trim().toLowerCase()

        if (provider === 'meta' || provider === 'whatsapp_cloud_api') {
            return this.deliverMetaTextMessage({
                message: input.message,
                recipientPhoneNumber,
                config,
            })
        }

        return {
            delivered: false,
            channel: 'whatsapp-unsupported',
            reason: 'unsupported_provider',
            provider,
            message: input.message,
            recipient_phone_number: recipientPhoneNumber,
            config: this.redactConfig(config),
        }
    }

    async sendTextMessage(input: {
        hotelId?: number | null
        recipientPhoneNumber?: string | null
        message: string
        configOverride?: WhatsAppConfig | null
    }) {
        const settings = await this.resolveSettings(input.hotelId)
        return this.deliver({
            settings,
            recipientPhoneNumber: input.recipientPhoneNumber,
            message: input.message,
            configOverride: input.configOverride,
        })
    }

    async notifyExtraChargeAdded(input: {
        hotelId?: number | null
        recipientPhoneNumber?: string | null
        recipientName?: string | null
        serviceName: string
        amountFcfa: string
        bookingTotalFcfa: string
    }) {
        return this.sendTextMessage({
            hotelId: input.hotelId,
            recipientPhoneNumber: input.recipientPhoneNumber,
            message: this.buildMessage(input),
        })
    }



    async notifyReservationConfirmed(input: {
        hotelId?: number | null
        recipientPhoneNumber?: string | null
        recipientName?: string | null
        reservationNumber: string
        roomType: string
        checkInDate: string
        checkOutDate: string
        hotelName: string
    }) {
        return this.sendTextMessage({
            hotelId: input.hotelId,
            recipientPhoneNumber: input.recipientPhoneNumber,
            message: this.buildReservationMessage(input),
        })
    }

    async notifyCheckIn(input: {
        hotelId?: number | null
        recipientPhoneNumber?: string | null
        recipientName?: string | null
        roomNumber: string
        hotelName: string
        checkOutDate: string
    }) {
        return this.sendTextMessage({
            hotelId: input.hotelId,
            recipientPhoneNumber: input.recipientPhoneNumber,
            message: this.buildCheckInMessage(input),
        })
    }

    async notifyRoomPosting(input: {
        hotelId?: number | null
        recipientPhoneNumber?: string | null
        recipientName?: string | null
        serviceName: string
        amountFcfa: string
        bookingTotalFcfa: string
    }) {
        return this.sendTextMessage({
            hotelId: input.hotelId,
            recipientPhoneNumber: input.recipientPhoneNumber,
            message: this.buildRoomPostingMessage(input),
        })
    }

    async notifyCheckOut(input: {
        hotelId?: number | null
        recipientPhoneNumber?: string | null
        recipientName?: string | null
        hotelName: string
        totalFcfa: string
        reservationNumber: string
    }) {
        return this.sendTextMessage({
            hotelId: input.hotelId,
            recipientPhoneNumber: input.recipientPhoneNumber,
            message: this.buildCheckOutMessage(input),
        })
    }
}