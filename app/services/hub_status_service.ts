import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import RoomRate from '#models/room_rate'
import Reservation from '#models/reservation'
import HubService, { isHotelOnHub } from '#services/hub_service'
import { HUB_CANCEL_STATUSES } from '#services/hub_cancel_sync'

/**
 * State of the link between an enjoy hotel and the hub, the equivalent of
 * `node ace hub:doctor` for one hotel. Consumed by
 * `GET /api/hub-control/hotels/:id/status` (connect-hub-backend/docs/enjoy-control-api.md).
 *
 * The link itself is local (hub_property_id + key), so the answer stays useful
 * when the hub is unreachable: `api_key_valid` is then false and `webhook.url`
 * is unknown.
 */

export type HubHotelStatus = {
  linked: boolean
  api_key_valid: boolean | null
  webhook: { url: string | null; configured: boolean }
  catalog: {
    room_types: { linked: number; total: number }
    rate_plans: { linked: number; total: number }
  }
  pending_cancellations: number
  last_push_at: string | null
}

export default class HubStatusService {
  static async forHotel(hotel: Hotel): Promise<HubHotelStatus> {
    const linked = Boolean(hotel.hubApiKey && hotel.hubPropertyId)

    let apiKeyValid: boolean | null = null
    let webhook: HubHotelStatus['webhook'] = { url: null, configured: false }

    if (hotel.hubApiKey) {
      try {
        const res: any = await new HubService(hotel.hubApiKey).getWebhook()
        const url = res?.data?.url ?? null
        apiKeyValid = true
        webhook = { url, configured: Boolean(url) }
      } catch {
        apiKeyValid = false
      }
    }

    const [roomTypesTotal, roomTypesLinked, ratesTotal, ratesLinked, pending] = await Promise.all([
      RoomType.query()
        .where('hotel_id', hotel.id)
        .where((q) => q.where('is_deleted', false).orWhereNull('is_deleted'))
        .count('* as total'),
      RoomType.query()
        .where('hotel_id', hotel.id)
        .whereNotNull('hub_room_type_id')
        .count('* as total'),
      RoomRate.query().where('hotel_id', hotel.id).count('* as total'),
      RoomRate.query()
        .where('hotel_id', hotel.id)
        .whereNotNull('hub_rate_plan_id')
        .count('* as total'),
      Reservation.query()
        .where('hotel_id', hotel.id)
        .whereNotNull('hub_booking_id')
        .whereNull('hub_cancel_synced_at')
        .whereIn('status', HUB_CANCEL_STATUSES)
        .count('* as total'),
    ])

    return {
      linked,
      api_key_valid: hotel.hubApiKey ? apiKeyValid : null,
      webhook,
      catalog: {
        room_types: {
          linked: Number(roomTypesLinked[0].$extras.total) || 0,
          total: Number(roomTypesTotal[0].$extras.total) || 0,
        },
        rate_plans: {
          linked: Number(ratesLinked[0].$extras.total) || 0,
          total: Number(ratesTotal[0].$extras.total) || 0,
        },
      },
      pending_cancellations: Number(pending[0].$extras.total) || 0,
      // enjoy stores no push timestamp; the contract allows null.
      last_push_at: null,
    }
  }

  static isLinked(hotel: Hotel): boolean {
    return isHotelOnHub(hotel) && Boolean(hotel.hubPropertyId)
  }
}
