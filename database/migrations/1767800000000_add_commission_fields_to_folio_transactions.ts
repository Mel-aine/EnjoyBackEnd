import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_commissionable').defaultTo(false)
      table.decimal('commission_rate', 12, 2).nullable()
      table.decimal('commission_amount', 12, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_commissionable')
      table.dropColumn('commission_rate')
      table.dropColumn('commission_amount')
    })
  }
}
