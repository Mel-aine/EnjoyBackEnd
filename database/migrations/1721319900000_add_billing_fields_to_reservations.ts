import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('remaining_amount', 15, 2).nullable()
      table.boolean('invoice_available').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('remaining_amount')
      table.dropColumn('invoice_available')
    })
  }
}