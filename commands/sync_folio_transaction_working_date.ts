import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class SyncFolioTransactionWorkingDate extends BaseCommand {
  public static commandName = 'folio:sync-working-date'
  public static description =
    'Update folio_transactions.current_working_date to match transaction_date (date portion) for a hotel'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID', alias: 'h' })
  declare hotelId: number | undefined

  public async run() {
    const hotelId = Number(this.hotelId)

    if (!Number.isFinite(hotelId) || hotelId <= 0) {
      this.logger.error('Missing or invalid --hotel-id')
      return
    }

    const totalResult = await db
      .from('folio_transactions')
      .where('hotel_id', hotelId)
      .count('* as total')
      .first()

    const total = Number(totalResult?.total ?? 0)
    this.logger.info(`Hotel ${hotelId}: ${total} folio_transactions found`)

    const updateResult = await db.rawQuery(
      `
      UPDATE folio_transactions
      SET current_working_date = DATE(transaction_date)
      WHERE hotel_id = ?
        AND transaction_date IS NOT NULL
        AND current_working_date IS DISTINCT FROM DATE(transaction_date)
      `,
      [hotelId]
    )
    const updated = Number((updateResult as any)?.rowCount ?? 0)

    this.logger.success(`Hotel ${hotelId}: updated ${updated} folio_transactions`)
  }
}
