import Hotel from '#models/hotel'
import env from '#start/env'
import WhatsappLog from '#models/whatsapp_log'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'

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

type MetaTemplateComponent = {
  type: 'body' | 'header' | 'button'
  parameters: Array<{ type: 'text'; text: string }>
  sub_type?: 'url' | 'quick_reply'
  index?: number
}




export default class WhatsAppNotificationService {



  private async writeLog(input: {
    hotelId: number | null | undefined
    reservationId?: number | null
    reservationNumber?: string | null
    templateName?: string | null
    recipientPhone: string | null
    messageBody: string
    credentialSource?: string | null
    deliveryResult: Record<string, any>
  }): Promise<void> {
    try {
      const res = input.deliveryResult
      const metaMessageId: string | null = res.provider_response?.messages?.[0]?.id ?? null
      const status = res.delivered ? 'sent' : 'failed'

      await WhatsappLog.create({
        hotelId: input.hotelId ?? 0,
        reservationId: input.reservationId ?? null,
        metaMessageId,
        status,
        templateName: input.templateName ?? null,
        recipientPhone: input.recipientPhone,
        messageBody: input.messageBody,
        provider: res.provider ?? 'meta',
        credentialSource: input.credentialSource ?? null,
        providerResponse: res.provider_response ?? null,
        failureReason: res.delivered ? null : (res.reason ?? 'unknown'),
        sentAt: res.delivered ? DateTime.now() : null,
        failedAt: res.delivered ? null : DateTime.now(),
      })
    } catch (err) {
      logger.warn({ err }, '[WhatsAppNotificationService] Échec écriture log')
    }
  }

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

  private normalizePhoneNumber(value: unknown): string | null {
    const raw = String(value ?? '').trim()
    if (!raw) return null
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) return null
    return digits
  }

  private buildMetaEndpoint(config: WhatsAppConfig): string | null {
    const explicitEndpoint = String(config.endpoint_url ?? '').trim()
    if (explicitEndpoint) return explicitEndpoint

    const apiBaseUrl = String(config.api_base_url ?? 'https://graph.facebook.com').replace(/\/+$/, '')
    const apiVersion = String(config.api_version ?? 'v21.0').trim().replace(/^\/+/, '')
    const phoneNumberId = String(config.phone_number_id ?? '').trim()

    if (!phoneNumberId) return null
    return `${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`
  }

  private async resolveSettings(hotelId: number | null | undefined) {
    if (!hotelId) return { enabled: false, config: {} as WhatsAppConfig, reason: 'missing_hotel_id', credentialSource: null }

    const hotel = await Hotel.find(hotelId)
    if (!hotel) return { enabled: false, config: {} as WhatsAppConfig, reason: 'hotel_not_found', credentialSource: null }
    if (!hotel.whatsappEnabled) return { enabled: false, config: {} as WhatsAppConfig, reason: 'whatsapp_disabled_in_hotel', credentialSource: null }

    if (hotel.whatsappProviderType === 'platform') {
      return {
        enabled: true,
        config: MANAGED_API_CONFIG as WhatsAppConfig,
        reason: null,
        credentialSource: 'managed_api',
      }
    }

    return {
      enabled: true,
      config: { ...hotel.whatsappConfig, provider: hotel.whatsappProviderType } as WhatsAppConfig,
      reason: null,
      credentialSource: 'hotel_own',
    }
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
      return { delivered: false, channel: 'whatsapp-meta', provider: 'meta', reason: 'missing_access_token', message: input.message, config: this.redactConfig(input.config) }
    }
    if (!endpoint) {
      return { delivered: false, channel: 'whatsapp-meta', provider: 'meta', reason: 'missing_phone_number_id', message: input.message, config: this.redactConfig(input.config) }
    }

    try { new URL(endpoint) } catch {
      return { delivered: false, channel: 'whatsapp-meta', provider: 'meta', reason: 'invalid_endpoint_url', endpoint, message: input.message, config: this.redactConfig(input.config) }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: input.recipientPhoneNumber,
        type: 'text',
        text: { preview_url: false, body: input.message },
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        delivered: false, channel: 'whatsapp-meta', provider: 'meta',
        reason: 'provider_request_failed', status: response.status,
        message: input.message, recipient_phone_number: input.recipientPhoneNumber,
        config: this.redactConfig(input.config), provider_response: data,
      }
    }

    return {
      delivered: true, channel: 'whatsapp-meta', provider: 'meta',
      message: input.message, recipient_phone_number: input.recipientPhoneNumber,
      config: this.redactConfig(input.config), provider_response: data,
    }
  }

  private async deliverMetaTemplateMessage(input: {
    recipientPhoneNumber: string
    templateName: string
    languageCode: string
    components: MetaTemplateComponent[]
    config: WhatsAppConfig
  }) {
    const accessToken = String(
      input.config.access_token ?? input.config.token ?? input.config.bearer_token ?? ''
    ).trim()
    const endpoint = this.buildMetaEndpoint(input.config)

    if (!accessToken) {
      return { delivered: false, channel: 'whatsapp-meta', provider: 'meta', reason: 'missing_access_token' }
    }
    if (!endpoint) {
      return { delivered: false, channel: 'whatsapp-meta', provider: 'meta', reason: 'missing_phone_number_id' }
    }

    try { new URL(endpoint) } catch {
      return { delivered: false, channel: 'whatsapp-meta', provider: 'meta', reason: 'invalid_endpoint_url' }
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.recipientPhoneNumber,
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components: input.components,
      },
    }

    logger.info({ templateName: input.templateName, to: input.recipientPhoneNumber, components: input.components }, '[WA] Sending template')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      logger.warn({ status: response.status, data }, '[WA] Template delivery failed')
      return {
        delivered: false, channel: 'whatsapp-meta', provider: 'meta',
        reason: 'provider_request_failed', status: response.status,
        provider_response: data,
      }
    }

    return {
      delivered: true, channel: 'whatsapp-meta', provider: 'meta',
      provider_response: data,
    }
  }

  private async deliver(input: {
    settings: { enabled: boolean; config: WhatsAppConfig; reason: string | null }
    recipientPhoneNumber?: string | null
    message: string
    configOverride?: WhatsAppConfig | null
  }) {
    const hasConfigOverride = Boolean(input.configOverride && Object.keys(input.configOverride).length)
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
      return { delivered: false, channel: 'whatsapp-disabled', reason: settings.reason, message: input.message, config: this.redactConfig(config) }
    }
    if (!recipientPhoneNumber) {
      return { delivered: false, channel: 'whatsapp-disabled', reason: 'missing_recipient_phone_number', message: input.message, config: this.redactConfig(config) }
    }

    const provider = String(config.provider ?? 'meta').trim().toLowerCase()

    if (provider === 'meta' || provider === 'whatsapp_cloud_api') {
      return this.deliverMetaTextMessage({ message: input.message, recipientPhoneNumber, config })
    }

    return {
      delivered: false, channel: 'whatsapp-unsupported', reason: 'unsupported_provider',
      provider, message: input.message, recipient_phone_number: recipientPhoneNumber,
      config: this.redactConfig(config),
    }
  }

 

  async sendTextMessage(input: {
    hotelId?: number | null
    reservationId?: number | null
    recipientPhoneNumber?: string | null
    templateName?: string | null
    message: string
    configOverride?: WhatsAppConfig | null
  }) {
    const settings = await this.resolveSettings(input.hotelId)
    const result = await this.deliver({
      settings,
      recipientPhoneNumber: input.recipientPhoneNumber,
      message: input.message,
      configOverride: input.configOverride,
    })

    await this.writeLog({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      templateName: input.templateName,
      recipientPhone: input.recipientPhoneNumber ?? null,
      messageBody: input.message,
      credentialSource: settings.credentialSource ?? null,
      deliveryResult: result,
    })

    return result
  }

 

  async notifyReservationConfirmed(input: {
    hotelId?: number | null
    reservationId?: number | null
    recipientPhoneNumber?: string | null
    recipientName: string
    hotelName: string
    checkInDate: string
    checkOutDate: string  
    reservationNumber: string
    voucherUrl: string  
    roomType?: string   
  }) {
    const settings = await this.resolveSettings(input.hotelId)

    if (!settings.enabled) {
      await this.writeLog({
        hotelId: input.hotelId,
        reservationId: input.reservationId,
        templateName: 'htl_booking_confirms',
        recipientPhone: input.recipientPhoneNumber ?? null,
        messageBody: '',
        credentialSource: settings.credentialSource ?? null,
        deliveryResult: { delivered: false, reason: settings.reason },
      })
      return { delivered: false, reason: settings.reason }
    }

    const recipientPhone = this.normalizePhoneNumber(input.recipientPhoneNumber)
    if (!recipientPhone) {
      return { delivered: false, reason: 'missing_recipient_phone_number' }
    }

    const result = await this.deliverMetaTemplateMessage({
      recipientPhoneNumber: recipientPhone,
      templateName: 'htl_booking_confirms',
      languageCode: 'fr',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: input.recipientName },       // {{1}}
            { type: 'text', text: input.hotelName },           // {{2}}
            { type: 'text', text: input.checkInDate },         // {{3}}
            { type: 'text', text: input.voucherUrl },          // {{5}}
          ],
        },
      ],
      config: settings.config,
    })

    await this.writeLog({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      templateName: 'htl_booking_confirms',
      recipientPhone: input.recipientPhoneNumber ?? null,
      messageBody: `htl_booking_confirms | ${input.recipientName} | ${input.reservationNumber} | ${input.voucherUrl}`,
      credentialSource: settings.credentialSource ?? null,
      deliveryResult: result,
    })

    return result
  }



  async notifyCheckIn(input: {
    hotelId?: number | null
    reservationId?: number | null
    recipientPhoneNumber?: string | null
    recipientName: string
    hotelName: string
    checkInDate: string
    checkInTime?: string
    // champs legacy gardés pour compatibilité
    roomNumber?: string
    checkOutDate?: string
  }) {
    const settings = await this.resolveSettings(input.hotelId)

    if (!settings.enabled) {
      await this.writeLog({
        hotelId: input.hotelId,
        reservationId: input.reservationId,
        templateName: 'htl_checkin_remind',
        recipientPhone: input.recipientPhoneNumber ?? null,
        messageBody: '',
        credentialSource: settings.credentialSource ?? null,
        deliveryResult: { delivered: false, reason: settings.reason },
      })
      return { delivered: false, reason: settings.reason }
    }

    const recipientPhone = this.normalizePhoneNumber(input.recipientPhoneNumber)
    if (!recipientPhone) {
      return { delivered: false, reason: 'missing_recipient_phone_number' }
    }

    const result = await this.deliverMetaTemplateMessage({
      recipientPhoneNumber: recipientPhone,
      templateName: 'htl_checkin_remind',
      languageCode: 'en',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: input.recipientName },          // {{1}}
            { type: 'text', text: input.hotelName },              // {{2}}
            { type: 'text', text: input.checkInDate },            // {{3}}
            { type: 'text', text: input.checkInTime ?? '14:00' }, // {{4}}
          ],
        },
      ],
      config: settings.config,
    })

    await this.writeLog({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      templateName: 'htl_checkin_remind',
      recipientPhone: input.recipientPhoneNumber ?? null,
      messageBody: `htl_checkin_remind | ${input.recipientName} | ${input.checkInDate}`,
      credentialSource: settings.credentialSource ?? null,
      deliveryResult: result,
    })

    return result
  }



async notifyFeedbackSurvey(input: {
  hotelId?: number | null
  reservationId?: number | null
  recipientPhoneNumber?: string | null
  recipientName: string
  hotelName: string
  invoiceUrl: string
}) {
  const settings = await this.resolveSettings(input.hotelId)

  if (!settings.enabled) {
    await this.writeLog({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      templateName: 'feedback_surveys',
      recipientPhone: input.recipientPhoneNumber ?? null,
      messageBody: '',
      credentialSource: settings.credentialSource ?? null,
      deliveryResult: { delivered: false, reason: settings.reason },
    })
    return { delivered: false, reason: settings.reason }
  }

  const recipientPhone = this.normalizePhoneNumber(input.recipientPhoneNumber)
  if (!recipientPhone) {
    return { delivered: false, reason: 'missing_recipient_phone_number' }
  }

  const result = await this.deliverMetaTemplateMessage({
    recipientPhoneNumber: recipientPhone,
    templateName: 'feedback_surveys',
    languageCode: 'fr',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: input.recipientName }, // {{1}}
          { type: 'text', text: input.hotelName },     // {{2}}
          { type: 'text', text: input.invoiceUrl },    // {{3}}
        ],
      },
    ],
    config: settings.config,
  })

  await this.writeLog({
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    templateName: 'feedback_surveys',
    recipientPhone: input.recipientPhoneNumber ?? null,
    messageBody: `feedback_surveys | ${input.recipientName} | ${input.hotelName} | ${input.invoiceUrl}`,
    credentialSource: settings.credentialSource ?? null,
    deliveryResult: result,
  })

  return result
}

 async notifyCheckInWelcome(input: {
    hotelId?: number | null
    reservationId?: number | null
    reservationNumber?: string | null
    recipientPhoneNumber?: string | null
    // Guest
    recipientName: string
    // Chambre
    roomNumber: string
    // Hôtel
    hotelName: string
    wifiCode?: string | null
    breakfastStart?: string | null
    breakfastEnd?: string | null
    // Serrure connectée (optionnel)
    digitalKeyToken?: string | null  
  }) {
    const settings = await this.resolveSettings(input.hotelId)
 
    if (!settings.enabled) {
      await this.writeLog({
        hotelId: input.hotelId,
        reservationNumber: input.reservationNumber,
        templateName: 'checkin_welcome',
        recipientPhone: input.recipientPhoneNumber ?? null,
        messageBody: '',
        credentialSource: settings.credentialSource ?? null,
        deliveryResult: { delivered: false, reason: settings.reason },
      })
      return { delivered: false, reason: settings.reason }
    }
 
    const recipientPhone = this.normalizePhoneNumber(input.recipientPhoneNumber)
    if (!recipientPhone) {
      return { delivered: false, reason: 'missing_recipient_phone_number' }
    }
 
    // ── Valeurs par défaut ──────────────────────────────────────────────────
    const wifiCode       = input.wifiCode       || 'See front desk'
    const breakfastStart = input.breakfastStart || '07:00'
    const breakfastEnd   = input.breakfastEnd   || '10:00'
 
    const components: MetaTemplateComponent[] = [
      {
        type: 'header',
        parameters: [
          { type: 'text', text: input.hotelName },  
        ],
      },
      {
        type: 'body',
        parameters: [
        //   { type: 'text', text: input.hotelName },     
          { type: 'text', text: input.recipientName }, 
          { type: 'text', text: input.roomNumber },  
          { type: 'text', text: wifiCode },            
          { type: 'text', text: breakfastStart },      
          { type: 'text', text: breakfastEnd },       
        ],
      },
    ]
 
    // Bouton URL uniquement si une clé numérique est disponible
    if (input.digitalKeyToken) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [
          { type: 'text', text: input.digitalKeyToken },
        ],
      })
    }
 
    const result = await this.deliverMetaTemplateMessage({
      recipientPhoneNumber: recipientPhone,
      templateName: 'checkin_welcome',
      languageCode: 'fr',
      components,
      config: settings.config,
    })
 
    await this.writeLog({
      hotelId: input.hotelId,
      reservationNumber: input.reservationNumber ?? '',
      templateName: 'checkin_welcome',
      recipientPhone: input.recipientPhoneNumber ?? null,
      messageBody: `checkin_welcome | ${input.recipientName} | room ${input.roomNumber}`,
      credentialSource: settings.credentialSource ?? null,
      deliveryResult: result,
    })
 
    return result
  }



  async notifySpecialOffer(input: {
    hotelId?: number | null
    reservationId?: number | null
    recipientPhoneNumber?: string | null
    recipientName: string
    hotelName: string
    offerDescription: string
    validUntil: string
  }) {
    const settings = await this.resolveSettings(input.hotelId)

    if (!settings.enabled) {
      return { delivered: false, reason: settings.reason }
    }

    const recipientPhone = this.normalizePhoneNumber(input.recipientPhoneNumber)
    if (!recipientPhone) {
      return { delivered: false, reason: 'missing_recipient_phone_number' }
    }

    const result = await this.deliverMetaTemplateMessage({
      recipientPhoneNumber: recipientPhone,
      templateName: 'htl_special_offer',
      languageCode: 'en',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: input.recipientName },       
            { type: 'text', text: input.hotelName },           
            { type: 'text', text: input.offerDescription },    
            { type: 'text', text: input.validUntil },          
          ],
        },
      ],
      config: settings.config,
    })

    await this.writeLog({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      templateName: 'htl_special_offer',
      recipientPhone: input.recipientPhoneNumber ?? null,
      messageBody: `htl_special_offer | ${input.recipientName} | ${input.offerDescription}`,
      credentialSource: settings.credentialSource ?? null,
      deliveryResult: result,
    })

    return result
  }


  async notifyRoomPosting(input: {
    hotelId?: number | null
    reservationId?: number | null
    recipientPhoneNumber?: string | null
    recipientName?: string | null
    serviceName: string
    amountFcfa: string
    bookingTotalFcfa: string
  }) {
    const greeting = input.recipientName ? `Bonjour ${input.recipientName}, ` : 'Bonjour, '
    const message = `${greeting}le service "${input.serviceName}" a ete ajoute a votre sejour. Montant: ${input.amountFcfa} FCFA. Total a payer: ${input.bookingTotalFcfa} FCFA.`

    return this.sendTextMessage({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      recipientPhoneNumber: input.recipientPhoneNumber,
      templateName: 'room_posting',
      message,
    })
  }


  async notifyExtraChargeAdded(input: {
    hotelId?: number | null
    reservationId?: number | null
    recipientPhoneNumber?: string | null
    recipientName?: string | null
    serviceName: string
    amountFcfa: string
    bookingTotalFcfa: string
  }) {
    const greeting = input.recipientName ? `Bonjour ${input.recipientName}, ` : 'Bonjour, '
    const message = `${greeting}le service ${input.serviceName} a ete ajoute a votre sejour. Montant: ${input.amountFcfa}. Nouveau total a payer: ${input.bookingTotalFcfa}.`

    return this.sendTextMessage({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      recipientPhoneNumber: input.recipientPhoneNumber,
      message,
    })
  }

  // ── Cas A : client satisfait → lien Google ──────────────────────────────────
async sendFeedbackPositiveReply(input: {
  hotelId?: number | null
  reservationId?: number | null
  recipientPhoneNumber: string
  googlePlaceId: string
}) {
  const settings = await this.resolveSettings(input.hotelId)
  if (!settings.enabled) return { delivered: false, reason: settings.reason }

  const recipientPhone = this.normalizePhoneNumber(input.recipientPhoneNumber)
  if (!recipientPhone) return { delivered: false, reason: 'missing_recipient_phone_number' }

  const result = await this.deliverMetaTemplateMessage({
    recipientPhoneNumber: recipientPhone,
    templateName: 'feedback_positive_reply',
    languageCode: 'fr',
    components: [
      {
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [{ type: 'text', text: input.googlePlaceId }],
      },
    ],
    config: settings.config,
  })

  await this.writeLog({
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    templateName: 'feedback_positive_reply',
    recipientPhone: recipientPhone,
    messageBody: `feedback_positive_reply | google:${input.googlePlaceId}`,
    credentialSource: settings.credentialSource ?? null,
    deliveryResult: result,
  })

  return result
}

// ── Cas B : client mécontent → question ouverte (texte libre, fenêtre 24h) ──
async sendFeedbackNegativeReply(input: {
  hotelId?: number | null
  reservationId?: number | null
  recipientPhoneNumber: string
}) {
  return this.sendTextMessage({
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    recipientPhoneNumber: input.recipientPhoneNumber,
    templateName: 'feedback_negative_reply',
    message:
      "Nous sommes sincèrement désolés que votre séjour n'ait pas été à la hauteur de vos attentes. 😕\n\nPourriez-vous nous dire ici ce que nous aurions pu mieux faire ? Votre retour sera transmis directement à la direction pour nous améliorer.",
  })
}

async notifyExpenseAlert(input: {
 hotelId?: number | null
  reservationId?: number | null
  recipientPhoneNumber?: string | null
  recipientName: string   // {{1}}
  amount: string          // {{2}} ex: "5 000 FCFA"
  roomNumber: string      // {{3}} ex: "204"
  itemLabel: string       // {{4}} ex: "1x Jus de Gingembre - Bar"
  totalBalance: string    // {{5}} ex: "15 000 FCFA"
}) {
  const settings = await this.resolveSettings(input.hotelId)

  if (!settings.enabled) {
    await this.writeLog({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      templateName: 'expense_alerts',
      recipientPhone: input.recipientPhoneNumber ?? null,
      messageBody: '',
      credentialSource: settings.credentialSource ?? null,
      deliveryResult: { delivered: false, reason: settings.reason },
    })
    return { delivered: false, reason: settings.reason }
  }

  const recipientPhone = this.normalizePhoneNumber(input.recipientPhoneNumber)
  if (!recipientPhone) {
    return { delivered: false, reason: 'missing_recipient_phone_number' }
  }

  const result = await this.deliverMetaTemplateMessage({
    recipientPhoneNumber: recipientPhone,
    templateName: 'expense_alerts',
    languageCode: 'fr',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: input.recipientName },  // {{1}}
          { type: 'text', text: input.amount },         // {{2}}
          { type: 'text', text: input.roomNumber },     // {{3}}
          { type: 'text', text: input.itemLabel },      // {{4}}
          { type: 'text', text: input.totalBalance },
        ],
      },
    ],
    config: settings.config,
  })

  await this.writeLog({
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    templateName: 'expense_alert',
    recipientPhone: input.recipientPhoneNumber ?? null,
    messageBody: `expense_alert | room ${input.roomNumber} | ${input.itemLabel} | ${input.amount}`,
    credentialSource: settings.credentialSource ?? null,
    deliveryResult: result,
  })

  return result
}

async sendInvoiceLink(input: {
  hotelId?: number | null
  reservationId?: number | null
  recipientPhoneNumber?: string | null
  recipientName: string
  reservationNumber: string
  downloadUrl: string 
}) {
  const message = `Bonjour ${input.recipientName},\n\nVeuillez trouver votre facture pour la réservation *${input.reservationNumber}* :\n\n📄 ${input.downloadUrl}\n\nMerci pour votre confiance.`

  return this.sendTextMessage({
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    recipientPhoneNumber: input.recipientPhoneNumber,
    templateName: 'invoice_link',
    message,
  })
}

async sendVoucherLink(input: {
  hotelId?: number | null
  reservationId?: number | null
  recipientPhoneNumber?: string | null
  recipientName: string
  reservationNumber: string
  checkInDate: string
  checkOutDate: string
  downloadUrl: string  
}) {
  const message = `Bonjour ${input.recipientName},\n\nVoici votre confirmation de réservation *${input.reservationNumber}* :\n\n📅 Arrivée : ${input.checkInDate}\n📅 Départ : ${input.checkOutDate}\n\n📄 Télécharger votre voucher :\n${input.downloadUrl}\n\nNous vous souhaitons un excellent séjour.`

  return this.sendTextMessage({
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    recipientPhoneNumber: input.recipientPhoneNumber,
    templateName: 'voucher_link',
    message,
  })
}

// ── Notifier facture prête 
async notifyInvoiceReady(input: {
  hotelId?: number | null
  reservationId?: number | null
  recipientPhoneNumber?: string | null
  recipientName: string
  hotelName: string
  reservationNumber: string
  invoiceUrl: string
}) {
  const settings = await this.resolveSettings(input.hotelId)

  if (!settings.enabled) {
    await this.writeLog({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      templateName: 'invoice_ready',
      recipientPhone: input.recipientPhoneNumber ?? null,
      messageBody: '',
      credentialSource: settings.credentialSource ?? null,
      deliveryResult: { delivered: false, reason: settings.reason },
    })
    return { delivered: false, reason: settings.reason }
  }

  const recipientPhone = this.normalizePhoneNumber(input.recipientPhoneNumber)
  if (!recipientPhone) return { delivered: false, reason: 'missing_recipient_phone_number' }

  const result = await this.deliverMetaTemplateMessage({
    recipientPhoneNumber: recipientPhone,
    templateName: 'invoice_ready',
    languageCode: 'fr',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: input.recipientName },      // {{1}}
          { type: 'text', text: input.hotelName },          // {{2}}
          { type: 'text', text: input.reservationNumber },  // {{3}}
          { type: 'text', text: input.invoiceUrl },         // {{4}}
        ],
      },
    ],
    config: settings.config,
  })

  await this.writeLog({
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    templateName: 'invoice_ready',
    recipientPhone: input.recipientPhoneNumber ?? null,
    messageBody: `invoice_ready | ${input.recipientName} | ${input.reservationNumber}`,
    credentialSource: settings.credentialSource ?? null,
    deliveryResult: result,
  })

  return result
}

// ── Notifier voucher prêt 
async notifyVoucherReady(input: {
  hotelId?: number | null
  reservationId?: number | null
  recipientPhoneNumber?: string | null
  recipientName: string
  hotelName: string
  reservationNumber: string
  checkInDate: string
  checkOutDate: string
  voucherUrl: string
}) {
  const settings = await this.resolveSettings(input.hotelId)

  if (!settings.enabled) {
    await this.writeLog({
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      templateName: 'voucher_ready',
      recipientPhone: input.recipientPhoneNumber ?? null,
      messageBody: '',
      credentialSource: settings.credentialSource ?? null,
      deliveryResult: { delivered: false, reason: settings.reason },
    })
    return { delivered: false, reason: settings.reason }
  }

  const recipientPhone = this.normalizePhoneNumber(input.recipientPhoneNumber)
  if (!recipientPhone) return { delivered: false, reason: 'missing_recipient_phone_number' }

  const result = await this.deliverMetaTemplateMessage({
    recipientPhoneNumber: recipientPhone,
    templateName: 'voucher_ready',
    languageCode: 'fr',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: input.recipientName },      // {{1}}
          { type: 'text', text: input.hotelName },          // {{2}}
          { type: 'text', text: input.reservationNumber },  // {{3}}
          { type: 'text', text: input.checkInDate },        // {{4}}
          { type: 'text', text: input.checkOutDate },       // {{5}}
          { type: 'text', text: input.voucherUrl },         // {{6}}
        ],
      },
    ],
    config: settings.config,
  })

  await this.writeLog({
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    templateName: 'voucher_ready',
    recipientPhone: input.recipientPhoneNumber ?? null,
    messageBody: `voucher_ready | ${input.recipientName} | ${input.reservationNumber}`,
    credentialSource: settings.credentialSource ?? null,
    deliveryResult: result,
  })

  return result
}

}