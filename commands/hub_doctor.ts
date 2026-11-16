import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import Hotel from '#models/hotel'
import User from '#models/user'
import RoomType from '#models/room_type'
import RoomRate from '#models/room_rate'
import Reservation from '#models/reservation'
import NotificationTemplate from '#models/notification_template'
import HubService, { isHubEnabled } from '#services/hub_service'
import { HUB_CANCEL_STATUSES } from '#services/hub_cancel_sync'

/**
 * Checks that the Hub OTA (and Channex) integration of enjoy is ready, before
 * and after going live. Exits with code 1 when a check fails, so CI or a
 * deploy script can run it.
 *
 *   node ace hub:doctor              (every hotel linked to the hub)
 *   node ace hub:doctor --hotel=1
 */
export default class HubDoctor extends BaseCommand {
  static commandName = 'hub:doctor'
  static description = 'Check the Hub OTA / Channex configuration of enjoy'

  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Only this enjoy hotel' })
  declare hotel?: number

  private failures = 0

  private ok(message: string) {
    this.logger.success(message)
  }

  private warn(message: string) {
    this.logger.warning(message)
  }

  private ko(message: string) {
    this.logger.error(message)
    this.failures++
  }

  async run() {
    // --- Global configuration ---------------------------------------------
    if (isHubEnabled()) this.ok(`Hub enabled (${env.get('HUB_BASE_URL')})`)
    else this.ko('Hub disabled: set HUB_ENABLED=true and HUB_BASE_URL')

    const userId = Number(env.get('AUTOPROCESS_USER_ID') ?? 2)
    const systemUser = await User.find(userId)
    if (systemUser) this.ok(`System user #${userId} exists (creates OTA reservations)`)
    else this.ko(`System user #${userId} not found: set AUTOPROCESS_USER_ID to an existing user`)

    for (const code of ['NEW_OTA_BOOKING', 'OTA_CANCELLATION', 'RESERVATION_CANCELLED_GUEST_OTA']) {
      const template = await NotificationTemplate.query().where('code', code).first()
      if (!template)
        this.warn(`Notification template ${code} missing (run the notification seeder)`)
      else if (!template.isActive) this.warn(`Notification template ${code} inactive`)
      else this.ok(`Notification template ${code}`)
    }

    if (env.get('CHANNEX_API_KEY')) this.ok('CHANNEX_API_KEY set')
    else this.ko('CHANNEX_API_KEY not set: every Channex call fails')
    this.logger.info(
      `Crons: Channex bookings ${env.get('CHANNEX_BOOKING_SYNC_CRON') ? 'ON' : 'off'}, ` +
        `Channex nightly resync ${env.get('CHANNEX_AVAILABILITY_RESYNC') ? 'ON' : 'off'}`
    )

    // --- Per hotel ----------------------------------------------------------
    const query = Hotel.query().whereNotNull('hub_api_key')
    if (this.hotel) query.where('id', this.hotel)
    const hotels = await query
    if (!hotels.length) this.warn('No hotel linked to the hub')

    for (const hotel of hotels) {
      this.logger.info(`--- Hotel ${hotel.id} "${hotel.hotelName}"`)
      if (!hotel.hubPropertyId) this.warn('No hub property id (run hub:sync-catalog)')

      const client = new HubService(hotel.hubApiKey!)
      try {
        const webhook: any = await client.getWebhook()
        this.ok('Hub accepts the PMS key')
        const url = webhook?.data?.url
        if (!url) this.ko('No webhook URL in the hub (hub:link --webhook-url=…)')
        else if (!url.endsWith(`/api/webhooks/hub/${hotel.id}`)) {
          this.ko(`Webhook URL does not point to this hotel: ${url}`)
        } else this.ok(`Webhook ${url}`)
        if (!hotel.hubWebhookSecret) this.ko('No webhook secret stored (hub:link --rotate-secret)')

        const feed = await client.getBookingsFeed(0, 200)
        const pending = Array.isArray(feed?.data) ? feed.data.length : 0
        if (pending) this.warn(`${pending} hub booking(s) waiting in the feed`)
        else this.ok('Hub feed empty')
      } catch (err) {
        this.ko(`Hub unreachable or key rejected: ${(err as any)?.message}`)
      }

      const roomTypes = await RoomType.query()
        .where('hotel_id', hotel.id)
        .where((q) => q.where('is_deleted', false).orWhereNull('is_deleted'))
      const unmappedRt = roomTypes.filter((rt) => !rt.hubRoomTypeId)
      if (unmappedRt.length) {
        this.warn(`Room types not on the hub: ${unmappedRt.map((rt) => rt.id).join(', ')}`)
      } else this.ok(`${roomTypes.length} room type(s) mapped`)

      const rates = await RoomRate.query().where('hotel_id', hotel.id)
      const unmappedRates = rates.filter((rr) => !rr.hubRatePlanId)
      if (unmappedRates.length) {
        this.warn(`Room rates not on the hub: ${unmappedRates.map((rr) => rr.id).join(', ')}`)
      } else this.ok(`${rates.length} room rate(s) mapped`)

      const pendingCancels = await Reservation.query()
        .where('hotel_id', hotel.id)
        .whereNotNull('hub_booking_id')
        .whereNull('hub_cancel_synced_at')
        .whereIn('status', HUB_CANCEL_STATUSES)
      if (pendingCancels.length)
        this.warn(`${pendingCancels.length} cancellation(s) not sent to the hub yet`)
      else this.ok('No cancellation waiting')

      if (hotel.channexPropertyId) this.ok(`Channex property ${hotel.channexPropertyId}`)
    }

    if (this.failures) {
      this.logger.error(`${this.failures} check(s) failed`)
      this.exitCode = 1
    } else {
      this.logger.success('All checks passed')
    }
  }
}
