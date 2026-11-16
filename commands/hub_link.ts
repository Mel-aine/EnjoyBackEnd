import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import RoomRate from '#models/room_rate'
import HubService from '#services/hub_service'

/**
 * Links an enjoy hotel to the Hub OTA and maps its room types and rates.
 *
 *   node ace hub:link --hotel=1 --property=12 --api-key=pms_xxx \
 *     --room-type=5:31 --room-type=6:32 --rate=40:77
 *
 * `--room-type=<enjoy room_type id>:<hub room_type id>`
 * `--rate=<enjoy room_rate id>:<hub rate_plan id>` (use 0 as hub id to unmap)
 *
 * Mappings are written with plain UPDATE queries so that the RoomType and
 * RoomRate model hooks (which push to Channex) are not triggered.
 */
export default class HubLink extends BaseCommand {
  static commandName = 'hub:link'
  static description = 'Link an enjoy hotel to the Hub OTA and map room types / rates'

  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'enjoy hotel id', required: true })
  declare hotel: number

  @flags.number({ description: 'Hub property id' })
  declare property?: number

  @flags.string({ description: 'Hub PMS API key (stored encrypted)' })
  declare apiKey?: string

  @flags.array({ description: '<enjoy room_type id>:<hub room_type id>' })
  declare roomType?: string[]

  @flags.array({ description: '<enjoy room_rate id>:<hub rate_plan id>' })
  declare rate?: string[]

  @flags.boolean({ description: 'Remove the hub link of this hotel (mappings are kept)' })
  declare unlink?: boolean

  @flags.boolean({ description: 'Skip the API key check against the hub' })
  declare skipCheck?: boolean

  @flags.string({
    description:
      'enjoy URL the hub calls on a new booking, e.g. https://api.enjoy…/api/webhooks/hub/<hotel id>',
  })
  declare webhookUrl?: string

  @flags.boolean({ description: 'Ask the hub for a new webhook signing secret' })
  declare rotateSecret?: boolean

  @flags.boolean({
    description:
      'Map automatically: hub room types / rate plans whose external_id is the enjoy room_type / room_rate id',
  })
  declare autoMap?: boolean

  /**
   * Hub room types and rate plans carry an `external_id`, the "identifiant PMS"
   * of the console. When it holds the enjoy id, the mapping needs no typing.
   * Derived hub plans are skipped: their price follows their parent.
   */
  private async autoMapPairs(hotel: Hotel) {
    const client = new HubService(hotel.hubApiKey!)
    const [hubRoomTypes, hubPlans] = await Promise.all([
      client.listRoomTypes(),
      client.listRatePlans(),
    ])
    const enjoyRoomTypes = await RoomType.query().where('hotel_id', hotel.id).select(['id'])
    const enjoyRates = await RoomRate.query()
      .where('hotel_id', hotel.id)
      .select(['id', 'room_type_id'])

    const inProperty = (rt: any) =>
      !hotel.hubPropertyId || Number(rt.propertyId) === Number(hotel.hubPropertyId)
    const hubRtByExternal = new Map<string, number>()
    for (const rt of hubRoomTypes.filter(inProperty)) {
      hubRtByExternal.set(String(rt.externalId), Number(rt.id))
    }

    const roomTypes: Array<[number, number | null]> = []
    for (const rt of enjoyRoomTypes) {
      const hubId = hubRtByExternal.get(String(rt.id))
      if (hubId) roomTypes.push([rt.id, hubId])
    }
    const hubRtOfEnjoy = new Map(roomTypes)

    const rates: Array<[number, number | null]> = []
    const plansByExternal = new Map<string, any[]>()
    for (const plan of hubPlans) {
      if (plan.parentRatePlanId) continue
      const key = String(plan.externalId)
      plansByExternal.set(key, [...(plansByExternal.get(key) ?? []), plan])
    }
    for (const rr of enjoyRates) {
      const hubRt = hubRtOfEnjoy.get(rr.roomTypeId)
      const plan = (plansByExternal.get(String(rr.id)) ?? []).find(
        (p) => Number(p.roomTypeId) === hubRt
      )
      if (plan) rates.push([rr.id, Number(plan.id)])
    }

    this.logger.info(
      `Auto-map: ${roomTypes.length}/${enjoyRoomTypes.length} room type(s), ${rates.length}/${enjoyRates.length} room rate(s) found in the hub`
    )
    return { roomTypes, rates }
  }

  private parsePairs(values: string[] | undefined, label: string): Array<[number, number | null]> {
    const pairs: Array<[number, number | null]> = []
    for (const raw of values ?? []) {
      const [local, hub] = String(raw)
        .split(':')
        .map((v) => Number(v))
      if (!Number.isInteger(local) || local <= 0 || !Number.isInteger(hub) || hub < 0) {
        throw new Error(`Invalid --${label} value "${raw}" (expected <enjoy id>:<hub id>)`)
      }
      pairs.push([local, hub === 0 ? null : hub])
    }
    return pairs
  }

  async run() {
    const hotel = await Hotel.find(this.hotel)
    if (!hotel) {
      this.logger.error(`Hotel ${this.hotel} not found`)
      this.exitCode = 1
      return
    }

    if (this.unlink) {
      hotel.hubApiKey = null
      hotel.hubWebhookSecret = null
      hotel.hubPropertyId = null
      await hotel.save()
      this.logger.success(`Hotel ${hotel.id} unlinked from the hub`)
      return
    }

    let roomTypePairs: Array<[number, number | null]>
    let ratePairs: Array<[number, number | null]>
    try {
      roomTypePairs = this.parsePairs(this.roomType, 'room-type')
      ratePairs = this.parsePairs(this.rate, 'rate')
    } catch (err) {
      this.logger.error((err as Error).message)
      this.exitCode = 1
      return
    }

    if (this.apiKey && !this.skipCheck) {
      if (!env.get('HUB_BASE_URL')) {
        this.logger.error(
          'HUB_BASE_URL is not set: cannot check the API key (use --skip-check to skip)'
        )
        this.exitCode = 1
        return
      }
      try {
        await new HubService(this.apiKey).getWebhook()
        this.logger.info('API key accepted by the hub')
      } catch (err) {
        this.logger.error(`The hub rejected the API key: ${(err as any)?.message}`)
        this.exitCode = 1
        return
      }
    }

    if (this.apiKey) hotel.hubApiKey = this.apiKey
    if (this.property) hotel.hubPropertyId = this.property
    if (this.apiKey || this.property) {
      await hotel.save()
      this.logger.success(`Hotel ${hotel.id} linked (hub property ${hotel.hubPropertyId ?? '-'})`)
    }

    if (this.webhookUrl) {
      if (!hotel.hubApiKey || !env.get('HUB_BASE_URL')) {
        this.logger.error('--webhook-url needs an API key (--api-key) and HUB_BASE_URL')
        this.exitCode = 1
        return
      }
      // The hub shows the secret only when it creates it: rotate when we do not hold it.
      const rotate = !!this.rotateSecret || !hotel.hubWebhookSecret
      try {
        const res: any = await new HubService(hotel.hubApiKey).putWebhook(this.webhookUrl, rotate)
        const secret = res?.data?.secret
        if (secret) {
          hotel.hubWebhookSecret = secret
          await hotel.save()
          this.logger.success('Webhook registered, signing secret stored (encrypted)')
        } else if (!hotel.hubWebhookSecret) {
          this.logger.error('The hub did not return a secret: run again with --rotate-secret')
          this.exitCode = 1
          return
        } else {
          this.logger.success('Webhook URL updated (existing secret kept)')
        }
      } catch (err) {
        this.logger.error(`Webhook registration failed: ${(err as any)?.message}`)
        this.exitCode = 1
        return
      }
    }

    if (this.autoMap) {
      if (!hotel.hubApiKey || !env.get('HUB_BASE_URL')) {
        this.logger.error('--auto-map needs an API key (--api-key) and HUB_BASE_URL')
        this.exitCode = 1
        return
      }
      try {
        const auto = await this.autoMapPairs(hotel)
        // Explicit --room-type / --rate values win over the automatic ones.
        const explicitRt = new Set(roomTypePairs.map(([id]) => id))
        const explicitRate = new Set(ratePairs.map(([id]) => id))
        roomTypePairs = [...auto.roomTypes.filter(([id]) => !explicitRt.has(id)), ...roomTypePairs]
        ratePairs = [...auto.rates.filter(([id]) => !explicitRate.has(id)), ...ratePairs]
      } catch (err) {
        this.logger.error(`Auto-map failed: ${(err as any)?.message}`)
        this.exitCode = 1
        return
      }
    }

    for (const [localId, hubId] of roomTypePairs) {
      const updated = await RoomType.query()
        .where('id', localId)
        .where('hotel_id', hotel.id)
        .update({ hub_room_type_id: hubId })
      if (!Number(Array.isArray(updated) ? updated[0] : updated)) {
        this.logger.warning(`Room type ${localId} not found in hotel ${hotel.id}`)
      } else {
        this.logger.info(`Room type ${localId} -> hub ${hubId ?? '(unmapped)'}`)
      }
    }

    for (const [localId, hubId] of ratePairs) {
      const updated = await RoomRate.query()
        .where('id', localId)
        .where('hotel_id', hotel.id)
        .update({ hub_rate_plan_id: hubId })
      if (!Number(Array.isArray(updated) ? updated[0] : updated)) {
        this.logger.warning(`Room rate ${localId} not found in hotel ${hotel.id}`)
      } else {
        this.logger.info(`Room rate ${localId} -> hub ${hubId ?? '(unmapped)'}`)
      }
    }

    const mapped = await RoomType.query()
      .where('hotel_id', hotel.id)
      .whereNotNull('hub_room_type_id')
    this.logger.info(
      `Mapped room types: ${mapped.map((rt) => `${rt.id}->${rt.hubRoomTypeId}`).join(', ') || 'none'}`
    )
    if (mapped.length) {
      this.logger.info(`Next: node ace hub:push-availability --hotel=${hotel.id}`)
    }
  }
}
