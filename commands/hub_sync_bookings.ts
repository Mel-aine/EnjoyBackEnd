import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import HubBookingSync from '#services/hub_booking_sync'
import { isHubEnabled } from '#services/hub_service'

/**
 * Reads the Hub OTA booking feed now (what the webhook and the 1-minute cron do).
 *
 *   node ace hub:sync-bookings --hotel=1
 *   node ace hub:sync-bookings            (every linked hotel)
 */
export default class HubSyncBookings extends BaseCommand {
  static commandName = 'hub:sync-bookings'
  static description = 'Import Hub OTA bookings into enjoy and acknowledge them'

  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'enjoy hotel id (default: every linked hotel)' })
  declare hotel?: number

  async run() {
    if (!isHubEnabled()) {
      this.logger.error('Hub is disabled: set HUB_ENABLED=true and HUB_BASE_URL')
      this.exitCode = 1
      return
    }

    const results = this.hotel
      ? [await HubBookingSync.syncHotel(this.hotel)].filter((r) => r !== null)
      : await HubBookingSync.syncAll()

    if (!results.length) this.logger.warning('No linked hotel processed')
    for (const r of results) {
      this.logger.info(
        `Hotel ${r!.hotelId}: ${r!.created} created, ${r!.cancelled} cancelled, ${r!.acked} acked, ${r!.skipped} skipped`
      )
      for (const e of r!.errors) this.logger.error(`  booking ${e.bookingId}: ${e.error}`)
      if (r!.errors.length) this.exitCode = 1
    }
  }
}
