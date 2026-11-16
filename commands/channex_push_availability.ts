import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ChannexAvailabilityResync from '#services/channex_availability_resync'

/**
 * Rewrites Channex availability with the values computed by enjoy.
 * Overwrites values edited by hand in the Channex dashboard on that period.
 *
 *   node ace channex:push-availability --hotel=1 --days=365
 *   node ace channex:push-availability            (every hotel linked to Channex)
 */
export default class ChannexPushAvailability extends BaseCommand {
  static commandName = 'channex:push-availability'
  static description = 'Push enjoy availability to Channex (absolute values) for linked hotels'

  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'enjoy hotel id (default: every hotel linked to Channex)' })
  declare hotel?: number

  @flags.number({ description: 'Number of days from today', default: 365 })
  declare days: number

  async run() {
    const results = this.hotel
      ? [await ChannexAvailabilityResync.resyncHotel(this.hotel, this.days)]
      : await ChannexAvailabilityResync.resyncAll(this.days)

    if (!results.length) this.logger.warning('No hotel is linked to Channex')
    for (const r of results) {
      if (r.status === 'done') this.logger.success(`Hotel ${r.hotelId}: ${r.ranges} range(s) sent`)
      else if (r.status === 'skipped') this.logger.warning(`Hotel ${r.hotelId}: ${r.message}`)
      else {
        this.logger.error(`Hotel ${r.hotelId}: ${r.message}`)
        this.exitCode = 1
      }
    }
  }
}
