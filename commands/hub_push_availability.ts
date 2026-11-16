import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import HubAvailabilitySync from '#services/hub_availability_sync'
import { isHubEnabled } from '#services/hub_service'

/**
 * Sends absolute availability to the Hub OTA. Use it once after `hub:link`,
 * then the nightly resync (start/scheduler.ts) and model hooks keep it up to date.
 *
 *   node ace hub:push-availability --hotel=1 --days=365
 *   node ace hub:push-availability            (every linked hotel)
 */
export default class HubPushAvailability extends BaseCommand {
  static commandName = 'hub:push-availability'
  static description = 'Push availability of linked hotels to the Hub OTA (absolute values)'

  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'enjoy hotel id (default: every linked hotel)' })
  declare hotel?: number

  @flags.number({ description: 'Number of days from today', default: 365 })
  declare days: number

  async run() {
    if (!isHubEnabled()) {
      this.logger.error('Hub is disabled: set HUB_ENABLED=true and HUB_BASE_URL')
      this.exitCode = 1
      return
    }

    if (!this.hotel) {
      const results = await HubAvailabilitySync.resyncAll(this.days)
      for (const r of results) {
        if (r.error) this.logger.error(`Hotel ${r.hotelId}: ${r.error}`)
        else
          this.logger.info(
            `Hotel ${r.hotelId}: ${r.updated} night(s) updated, ${r.oversold} oversold`
          )
      }
      if (!results.length) this.logger.warning('No hotel is linked to the hub')
      if (results.some((r) => r.error)) this.exitCode = 1
      return
    }

    const from = DateTime.now().startOf('day')
    const to = from.plus({ days: Math.max(1, this.days) - 1 })
    try {
      const res = await HubAvailabilitySync.pushRange(this.hotel, from, to)
      if (res.skipped) {
        this.logger.warning(`Hotel ${this.hotel} is not linked or has no mapped room type`)
        return
      }
      this.logger.success(`${res.updated} night(s) updated`)
      for (const o of res.oversold) {
        this.logger.warning(
          `Oversold: hub room type ${o.room_type_id} on ${o.date} (total ${o.total}, held ${o.held}, sold ${o.sold})`
        )
      }
    } catch (err) {
      this.logger.error(`Push failed: ${(err as any)?.message}`)
      this.exitCode = 1
    }
  }
}
