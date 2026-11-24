import env from '#start/env'
import Hotel from '#models/hotel'
import Room from '#models/room'
import RoomType from '#models/room_type'
import RoomRate from '#models/room_rate'
import HubService, { type HubSyncMessage } from '#services/hub_service'

/**
 * Creates in the Hub OTA what is missing for an enjoy hotel, so nobody has to
 * type the catalog in the hub console:
 *   - the property (external_id = enjoy hotel id), if the hotel has none;
 *   - one hub room type per enjoy room type (external_id = enjoy room_type id);
 *   - one hub rate plan per enjoy room rate (external_id = enjoy room_rate id).
 * Existing hub items with the same external_id are reused, never duplicated.
 * The mapping (hub_*_id columns) is saved as it goes.
 *
 * Single implementation shared by `node ace hub:sync-catalog` and
 * `POST /api/hub-control/hotels/:id/sync-catalog`.
 */

export type CatalogSyncReport = {
  roomTypesCreated: number
  roomTypesReused: number
  ratePlansCreated: number
  ratePlansReused: number
  links: { roomTypes: number; ratePlans: number }
  messages: HubSyncMessage[]
}

export default class HubCatalogSync {
  static async sync(
    hotelId: number,
    options: { dryRun?: boolean } = {}
  ): Promise<CatalogSyncReport> {
    const messages: HubSyncMessage[] = []
    const log = (level: HubSyncMessage['level'], message: string) => {
      messages.push({ level, message })
    }

    const hotel = await Hotel.find(hotelId)
    if (!hotel) throw new Error(`Hotel ${hotelId} not found`)
    if (!hotel.hubApiKey) throw new Error('No hub API key: link the hotel to the hub first')
    if (!env.get('HUB_BASE_URL')) throw new Error('HUB_BASE_URL is not set')

    const client = new HubService(hotel.hubApiKey)
    const dry = !!options.dryRun
    const report: CatalogSyncReport = {
      roomTypesCreated: 0,
      roomTypesReused: 0,
      ratePlansCreated: 0,
      ratePlansReused: 0,
      links: { roomTypes: 0, ratePlans: 0 },
      messages,
    }

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
        log('info', `[dry-run] would create hub property "${body.name}"`)
      } else {
        const property = await client.createProperty(body)
        hotel.hubPropertyId = Number(property.id)
        await hotel.save()
        log('success', `Hub property #${property.id} created`)
      }
    }
    const propertyId = hotel.hubPropertyId

    // 2. Room types
    const [hubRoomTypes, hubPlans] = await Promise.all([
      client.listRoomTypes(),
      client.listRatePlans(),
    ])
    const hubRtByExternal = new Map<string, number>()
    const hubRtById = new Map<number, any>()
    for (const rt of hubRoomTypes) {
      if (!propertyId || Number(rt.propertyId) === Number(propertyId)) {
        hubRtByExternal.set(String(rt.externalId), Number(rt.id))
        hubRtById.set(Number(rt.id), rt)
      }
    }

    const roomTypes = await RoomType.query()
      .where('hotel_id', hotel.id)
      .where((q) => q.where('is_deleted', false).orWhereNull('is_deleted'))
    const hubRtOfLocal = new Map<number, number>()
    for (const rt of roomTypes) {
      // A mapping can outlive the hub room type (hub database reset, property
      // deleted). Reusing it blindly makes sync-catalog report "reused" while
      // the hub has nothing, and every ARI push then targets a missing id.
      const mapped = rt.hubRoomTypeId ? hubRtById.get(Number(rt.hubRoomTypeId)) : null
      if (rt.hubRoomTypeId && !mapped) {
        log(
          'warning',
          `Room type ${rt.id} pointed to hub #${rt.hubRoomTypeId}, which no longer exists: remapping it`
        )
      }
      const existing = mapped
        ? Number(mapped.id)
        : hubRtByExternal.get(String(rt.id)) ?? null
      let hubId: number | null = existing
      if (!existing) {
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
          log('info', `[dry-run] would create hub room type "${rt.roomTypeName}"`)
          report.roomTypesCreated++
          continue
        }
        const created = await client.createRoomType(body)
        hubId = Number(created.id)
        report.roomTypesCreated++
        log(
          'success',
          `Room type ${rt.id} "${rt.roomTypeName}" -> hub #${hubId} (created)`
        )
      } else {
        report.roomTypesReused++
      }
      if (!hubId) continue
      hubRtOfLocal.set(rt.id, hubId)
      if (!dry && rt.hubRoomTypeId !== hubId) {
        await RoomType.query().where('id', rt.id).update({ hub_room_type_id: hubId })
      }
    }

    // 3. Rate plans
    const hubPlanByExternal = new Map<string, any>()
    const hubPlanById = new Map<number, any>()
    for (const plan of hubPlans) {
      hubPlanByExternal.set(`${plan.roomTypeId}:${plan.externalId}`, plan)
      hubPlanById.set(Number(plan.id), plan)
    }

    const rates = await RoomRate.query().where('hotel_id', hotel.id).preload('rateType')
    for (const rr of rates) {
      const hubRt = hubRtOfLocal.get(rr.roomTypeId)
      if (!hubRt) continue
      const mapped =
        rr.hubRatePlanId && Number(hubPlanById.get(Number(rr.hubRatePlanId))?.roomTypeId) === hubRt
          ? hubPlanById.get(Number(rr.hubRatePlanId))
          : null
      if (rr.hubRatePlanId && !mapped) {
        log(
          'warning',
          `Room rate ${rr.id} pointed to hub rate plan #${rr.hubRatePlanId}, which no longer exists: remapping it`
        )
      }
      const existing = mapped
        ? Number(mapped.id)
        : hubPlanByExternal.get(`${hubRt}:${rr.id}`)?.id ?? null
      let hubPlanId: number | null = existing ? Number(existing) : null
      if (!existing) {
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
          log('info', `[dry-run] would create hub rate plan "${name}"`)
          report.ratePlansCreated++
          continue
        }
        const created = await client.createRatePlan(body)
        hubPlanId = Number(created.id)
        report.ratePlansCreated++
        log('success', `Room rate ${rr.id} "${name}" -> hub #${hubPlanId} (created)`)
      } else {
        report.ratePlansReused++
      }
      if (!dry && hubPlanId && rr.hubRatePlanId !== hubPlanId) {
        await RoomRate.query().where('id', rr.id).update({ hub_rate_plan_id: hubPlanId })
      }
    }

    if (!dry) {
      const [linkedRoomTypes, linkedRatePlans] = await Promise.all([
        RoomType.query()
          .where('hotel_id', hotel.id)
          .whereNotNull('hub_room_type_id')
          .count('* as total'),
        RoomRate.query()
          .where('hotel_id', hotel.id)
          .whereNotNull('hub_rate_plan_id')
          .count('* as total'),
      ])
      report.links = {
        roomTypes: Number(linkedRoomTypes[0].$extras.total) || 0,
        ratePlans: Number(linkedRatePlans[0].$extras.total) || 0,
      }
    }

    return report
  }
}
