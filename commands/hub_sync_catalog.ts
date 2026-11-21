import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import HubCatalogSync from '#services/hub_catalog_sync'

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
 *
 * The logic lives in HubCatalogSync, shared with the hub control API.
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
    try {
      const report = await HubCatalogSync.sync(this.hotel, { dryRun: !!this.dryRun })
      for (const message of report.messages) this.logger[message.level](message.message)
      if (!this.dryRun) {
        this.logger.info(
          `Mapped: ${report.links.roomTypes} room type(s), ${report.links.ratePlans} rate plan(s)`
        )
        this.logger.info(
          `Next: node ace hub:push-availability --hotel=${this.hotel} && node ace hub:push-rates --hotel=${this.hotel}`
        )
      }
    } catch (err) {
      this.logger.error((err as Error).message)
      this.exitCode = 1
    }
  }
}
