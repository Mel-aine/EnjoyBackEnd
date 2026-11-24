import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import HubRateSync from '#services/hub_rate_sync'
import { isHubEnabled } from '#services/hub_service'

/**
 * Seeds hub prices from enjoy room rates (base rate + restrictions), once
 * after `hub:link`. Later per-date changes made in the ARI screens are
 * mirrored automatically.
 *
 * Overwrites the hub prices on the chosen dates, including per-date prices
 * typed earlier: use --from / --days to limit the range.
 *
 *   node ace hub:push-rates --hotel=1 --days=365
 *   node ace hub:push-rates --hotel=1 --room-rate=40 --from=2027-01-01 --days=30
 */
export default class HubPushRates extends BaseCommand {
  static commandName = 'hub:push-rates'
  static description = 'Push base rates and restrictions of mapped room rates to the Hub OTA'

  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'enjoy hotel id', required: true })
  declare hotel: number

  @flags.string({ description: 'First date (YYYY-MM-DD, default today)' })
  declare from?: string

  @flags.number({ description: 'Number of days', default: 365 })
  declare days: number

  @flags.array({ description: 'Only these enjoy room_rate ids' })
  declare roomRate?: string[]

  async run() {
    if (!isHubEnabled()) {
      this.logger.error('Hub is disabled: set HUB_ENABLED=true and HUB_BASE_URL')
      this.exitCode = 1
      return
    }
    const today = DateTime.now().startOf('day')
    const from = this.from ? DateTime.fromISO(this.from).startOf('day') : today
    if (!from.isValid) {
      this.logger.error('--from must be YYYY-MM-DD')
      this.exitCode = 1
      return
    }
    const start = from < today ? today : from
    const to = start.plus({ days: Math.max(1, this.days) - 1 })
    const ids = (this.roomRate ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0)

    try {
      const res = await HubRateSync.pushBaseRates(
        this.hotel,
        start,
        to,
        ids.length ? ids : undefined
      )
      if (res.skipped) {
        this.logger.warning(`Hotel ${this.hotel} is not linked or has no mapped room rate`)
        return
      }
      this.logger.success(
        `${res.updated} price(s) updated (${start.toISODate()} → ${to.toISODate()})`
      )
    } catch (err) {
      const body = (err as any)?.body
      this.logger.error(
        `Push failed: ${(err as any)?.code ?? (err as any)?.message}${
          body ? ` — ${JSON.stringify(body).slice(0, 800)}` : ''
        }`
      )
      this.exitCode = 1
    }
  }
}
