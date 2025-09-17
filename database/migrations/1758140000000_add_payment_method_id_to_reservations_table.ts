import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('payment_method_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('payment_methods')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['payment_method_id'])
      table.dropColumn('payment_method_id')
    })
  }
}