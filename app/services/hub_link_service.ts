import env from '#start/env'
import type Hotel from '#models/hotel'
import HubService, { type HubSyncMessage } from '#services/hub_service'

/**
 * Links an enjoy hotel to the hub: stores the PMS key and the hub property id
 * (both encrypted for the key/secret), and registers the webhook the hub calls
 * on a new booking.
 *
 * Single implementation shared by `node ace hub:link` and
 * `POST /api/hub-control/hotels/:id/link`.
 *
 * The key is only checked against the hub when asked (`skipKeyCheck` false);
 * the control API always checks it, because the hub just created it.
 */

export type LinkHotelInput = {
  apiKey?: string
  hubPropertyId?: number | null
  webhookUrl?: string | null
  rotateSecret?: boolean
  skipKeyCheck?: boolean
}

export type LinkHotelOutcome = {
  linked: boolean
  webhookRegistered: boolean
  secretRotated: boolean
  messages: HubSyncMessage[]
}

export default class HubLinkService {
  static async link(hotel: Hotel, input: LinkHotelInput): Promise<LinkHotelOutcome> {
    const messages: HubSyncMessage[] = []
    const log = (level: HubSyncMessage['level'], message: string) => {
      messages.push({ level, message })
    }

    if (input.apiKey && !input.skipKeyCheck) {
      if (!env.get('HUB_BASE_URL')) {
        throw new Error('HUB_BASE_URL is not set: cannot check the API key (use --skip-check)')
      }
      try {
        await new HubService(input.apiKey).getWebhook()
        log('info', 'API key accepted by the hub')
      } catch (err) {
        throw new Error(`The hub rejected the API key: ${(err as any)?.message ?? err}`)
      }
    }

    if (input.apiKey) hotel.hubApiKey = input.apiKey
    if (input.hubPropertyId !== undefined && input.hubPropertyId !== null) {
      hotel.hubPropertyId = Number(input.hubPropertyId)
    }
    if (input.apiKey || input.hubPropertyId) {
      await hotel.save()
      log('success', `Hotel ${hotel.id} linked (hub property ${hotel.hubPropertyId ?? '-'})`)
    }

    let webhookRegistered = false
    let secretRotated = false

    if (input.webhookUrl) {
      if (!hotel.hubApiKey || !env.get('HUB_BASE_URL')) {
        throw new Error('A webhook URL needs an API key and HUB_BASE_URL')
      }
      // The hub shows the secret only when it creates it: rotate when we do not hold it.
      const rotate = !!input.rotateSecret || !hotel.hubWebhookSecret
      const res: any = await new HubService(hotel.hubApiKey).putWebhook(
        input.webhookUrl,
        rotate,
        hotel.hubPropertyId
      )
      const secret = res?.data?.secret
      webhookRegistered = true
      if (secret) {
        hotel.hubWebhookSecret = secret
        await hotel.save()
        secretRotated = true
        log('success', 'Webhook registered, signing secret stored (encrypted)')
      } else if (!hotel.hubWebhookSecret) {
        throw new Error('The hub did not return a secret: rotate it and try again')
      } else {
        log('success', 'Webhook URL updated (existing secret kept)')
      }
    }

    return {
      linked: Boolean(hotel.hubApiKey && hotel.hubPropertyId),
      webhookRegistered,
      secretRotated,
      messages,
    }
  }

  /** Removes the link; the room type / rate mappings are kept. */
  static async unlink(hotel: Hotel): Promise<void> {
    hotel.hubApiKey = null
    hotel.hubWebhookSecret = null
    hotel.hubPropertyId = null
    await hotel.save()
  }
}
