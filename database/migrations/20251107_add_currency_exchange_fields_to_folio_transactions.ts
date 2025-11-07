import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Store the original transaction amount in source currency
      table.decimal('original_amount', 12, 2).nullable()
      // Store the original/source currency code (e.g., USD)
      table.string('original_currency', 3).nullable()
      // Store the converted/base amount in the hotel's default currency
      table.decimal('base_currency_amount', 12, 2).nullable()
      // Date the exchange rate was effective
      table.date('exchange_rate_date').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('original_amount')
      table.dropColumn('original_currency')
      table.dropColumn('base_currency_amount')
      table.dropColumn('exchange_rate_date')
    })
  }
}