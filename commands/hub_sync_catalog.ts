import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import Hotel from '#models/hotel'
import Room from '#models/room'
import RoomType from '#models/room_type'
import RoomRate from '#models/room_rate'
import HubService from '#services/hub_service'

/**
 * Creates in the Hub OTA what is missing for an enjoy hotel, so nobody has to
 * type the catalog in the hub console:
 *   - the property (external_id = enjoy hotel id), if the hotel has none;
 *   - one hub room type per enjoy room type (external_id = enjoy room_type id);
 *   - one hub rate plan per enjoy room rate (external_id = enjoy room_rate id).
 * Existing hub items with the same external_id are reused, never duplicated.
 * The mapping (hub_*_id columns) is saved as it goes.
 *
 * Needs the hotel's hub API key first: `node ace hub:link --hotel=1 --api-key=…`.
 *
 *   node ace hub:sync-catalog --hotel=1
 *   node ace hub:sync-catalog --hotel=1 --dry-run
 */
export default class HubSyncCatalog extends BaseCommand {
  static commandName = 'hub:sync-catalog'
  static description =
    'Create the missing hub property, room types and rate plans of an enjoy hotel'

  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'enjoy hotel id', required: true })
  declare hotel: number

  @flags.boolean({ description: 'Show what would be created, create nothing' })
  declare dryRun?: boolean

  async run() {
    const hotel = await Hotel.find(this.hotel)
    if (!hotel) return this.fail(`Hotel ${this.hotel} not found`)
    if (!hotel.hubApiKey) return this.fail('No hub API key: run hub:link --api-key=… first')
    if (!env.get('HUB_BASE_URL')) return this.fail('HUB_BASE_URL is not set')

    const client = new HubService(hotel.hubApiKey)
    const dry = !!this.dryRun

    // 1. Property
    if (!hotel.hubPropertyId) {
      const body = {
        name: hotel.hotelName,
        external_id: String(hotel.id),
        currency: (hotel.currencyCode || 'XAF').toUpperCase(),
        timezone: hotel.timezone || 'Africa/Douala',
        address: hotel.address ?? null,
        city: hotel.city ?? null,
        country: hotel.country ?? null,
        email: hotel.email ?? null,
        phone: hotel.phoneNumber ?? null,
      }
      if (dry) {
        this.logger.info(`[dry-run] would create hub property "${body.name}"`)
      } else {
        const property = await client.createProperty(body)
        hotel.hubPropertyId = Number(property.id)
        await hotel.save()
        this.logger.success(`Hub property #${property.id} created`)
      }
    }
    const propertyId = hotel.hubPropertyId

    // 2. Room types
    const [hubRoomTypes, hubPlans] = await Promise.all([
      client.listRoomTypes(),
      client.listRatePlans(),
    ])
    const hubRtByExternal = new Map<string, number>()
    for (const rt of hubRoomTypes) {
      if (!propertyId || Number(rt.propertyId) === Number(propertyId)) {
        hubRtByExternal.set(String(rt.externalId), Number(rt.id))
      }
    }

    const roomTypes = await RoomType.query()
      .where('hotel_id', hotel.id)
      .where((q) => q.where('is_deleted', false).orWhereNull('is_deleted'))
    const hubRtOfLocal = new Map<number, number>()
    for (const rt of roomTypes) {
      let hubId = rt.hubRoomTypeId ?? hubRtByExternal.get(String(rt.id)) ?? null
      if (!hubId) {
        const count = await Room.query().where('room_type_id', rt.id).count('* as total')
        const body = {
          property_id: propertyId,
          external_id: String(rt.id),
          name: rt.roomTypeName,
          count_of_rooms: Math.max(1, Number(count[0].$extras.total) || 1),
          occ_adults: Math.max(1, Number(rt.maxAdult) || 2),
          occ_children: Math.max(0, Number(rt.maxChild) || 0),
          default_occupancy: Math.max(1, Number(rt.baseAdult) || Number(rt.maxAdult) || 1),
        }
        if (dry || !propertyId) {
          this.logger.info(`[dry-run] would create hub room type "${rt.roomTypeName}"`)
          continue
        }
        const created = await client.createRoomType(body)
        hubId = Number(created.id)
        this.logger.success(`Room type ${rt.id} "${rt.roomTypeName}" -> hub #${hubId} (created)`)
      }
      hubRtOfLocal.set(rt.id, hubId)
      if (!dry && rt.hubRoomTypeId !== hubId) {
        await RoomType.query().where('id', rt.id).update({ hub_room_type_id: hubId })
      }
    }

    // 3. Rate plans
    const hubPlanByExternal = new Map<string, any>()
    for (const plan of hubPlans)
      hubPlanByExternal.set(`${plan.roomTypeId}:${plan.externalId}`, plan)

    const rates = await RoomRate.query().where('hotel_id', hotel.id).preload('rateType')
    for (const rr of rates) {
      const hubRt = hubRtOfLocal.get(rr.roomTypeId)
      if (!hubRt) continue
      let hubPlanId = rr.hubRatePlanId ?? hubPlanByExternal.get(`${hubRt}:${rr.id}`)?.id ?? null
      if (!hubPlanId) {
        const roomType = roomTypes.find((t) => t.id === rr.roomTypeId)
        const name =
          `${roomType?.roomTypeName ?? 'Chambre'} ${rr.rateType?.rateTypeName ?? ''}`.trim()
        const body = {
          room_type_id: hubRt,
          external_id: String(rr.id),
          name,
          options: {
            currency: (hotel.currencyCode || 'XAF').toUpperCase(),
            default_rate: Number(rr.baseRate) || 0,
          },
        }
        if (dry) {
          this.logger.info(`[dry-run] would create hub rate plan "${name}"`)
          continue
        }
        const created = await client.createRatePlan(body)
        hubPlanId = Number(created.id)
        this.logger.success(`Room rate ${rr.id} "${name}" -> hub #${hubPlanId} (created)`)
      }
      if (!dry && rr.hubRatePlanId !== Number(hubPlanId)) {
        await RoomRate.query()
          .where('id', rr.id)
          .update({ hub_rate_plan_id: Number(hubPlanId) })
      }
    }

    if (!dry) {
      this.logger.info(
        `Next: node ace hub:push-availability --hotel=${hotel.id} && node ace hub:push-rates --hotel=${hotel.id}`
      )
    }
  }

  private fail(message: string) {
    this.logger.error(message)
    this.exitCode = 1
  }
}
