import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('currency_code', 3).defaultTo('XOF').nullable()
      table.decimal('exchange_rate', 15, 6).defaultTo(1.0).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('currency_code')
      table.dropColumn('exchange_rate')
    })
  }
}
