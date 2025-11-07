import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Database from '@adonisjs/lucid/services/db'
import Currency from '#models/currency'

export default class CurrencySetDefault extends BaseCommand {
  public static commandName = 'currency:set-default'
  public static description = 'Set a hotel currency (by code) as the default'
  public static options: CommandOptions = { startApp: true }

  public async run() {
    // Hardcoded like other import commands
    const hotelId = 5
    const code = 'XAF'

    // Basic validation
    if (!Number.isFinite(hotelId) || hotelId <= 0) {
      this.logger.error('Invalid hotelId')
      return
    }

    // Ensure the currency exists for the hotel
    const target = await Currency.query()
      .where('hotel_id', hotelId)
      .where('currency_code', code)
      .where('is_deleted', false)
      .first()

    if (!target) {
      this.logger.error(`Currency ${code} not found for hotel ${hotelId}`)
      return
    }

    // Use raw SQL updates to bypass the model immutability hook
    const trx = await Database.transaction()
    try {
      await trx.raw('UPDATE currencies SET is_default = false WHERE hotel_id = ? AND is_default = true', [hotelId])
      await trx.raw('UPDATE currencies SET is_default = true WHERE hotel_id = ? AND currency_code = ?', [hotelId, code])
      await trx.commit()
      this.logger.success(`Set ${code} as default currency for hotel ${hotelId}`)
    } catch (err: any) {
      await trx.rollback()
      this.logger.error(`Failed to set default currency: ${err.message}`)
    }
  }
}