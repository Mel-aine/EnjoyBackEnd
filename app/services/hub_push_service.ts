import { DateTime } from 'luxon'
import type Hotel from '#models/hotel'
import HubAvailabilitySync from '#services/hub_availability_sync'
import HubRateSync from '#services/hub_rate_sync'

/**
 * Sends availability and prices for N days, the equivalent of
 * `hub:push-availability` + `hub:push-rates`. Used by
 * `POST /api/hub-control/hotels/:id/push-ari`.
 *
 * Runs before answering (the contract allows either): the hub console shows the
 * counts as soon as the response arrives.
 */

export type PushAriReport = {
  job_id: string
  days: number
  status: 'completed'
  availability_updated: number
  rates_updated: number
  oversold: number
}

export default class HubPushService {
  static async pushAri(hotel: Hotel, days: number): Promise<PushAriReport> {
    const span = Math.min(Math.max(Math.trunc(days) || 365, 1), 730)
    const from = DateTime.now().startOf('day')
    const to = from.plus({ days: span - 1 })

    const availability = await HubAvailabilitySync.pushRange(hotel.id, from, to)
    const rates = await HubRateSync.pushBaseRates(hotel.id, from, to)

    return {
      job_id: `push-${hotel.id}-${Date.now()}`,
      days: span,
      status: 'completed',
      availability_updated: availability.updated ?? 0,
      rates_updated: rates.updated ?? 0,
      oversold: availability.oversold?.length ?? 0,
    }
  }
}
