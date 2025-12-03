import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import crypto from 'node:crypto'
import Hotel from '#models/hotel'

export default class GeneratePosApiKeys extends BaseCommand {
  public static commandName = 'pos:generate-keys'
  public static description = 'Generate POS API keys for all hotels missing one'
  public static options: CommandOptions = { startApp: true }

  private generateKey(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  public async run() {
    this.logger.info('Scanning hotels for missing POS API keys...')

    const hotels = await Hotel.query().select('id', 'hotel_name', 'pos_api_key')
    let updated = 0
    let skipped = 0

    // Preload existing keys to avoid accidental duplicates within this run
    const existingKeys = new Set(
      hotels
        .map(h => h.posApiKey)
        .filter((k): k is string => typeof k === 'string' && k.length > 0)
    )

    for (const hotel of hotels) {
      if (hotel.posApiKey && hotel.posApiKey.length > 0) {
        skipped++
        continue
      }

      // Generate a unique key not present in the current set
      let key: string
      do {
        key = this.generateKey()
      } while (existingKeys.has(key))

      hotel.posApiKey = key
      await hotel.save()
      existingKeys.add(key)
      updated++
      this.logger.info(`Generated POS key for hotel ${hotel.id} (${hotel.hotelName})`)
    }

    this.logger.success(`Done. Updated: ${updated}, Skipped (already had key): ${skipped}, Total: ${hotels.length}`)
  }
}

