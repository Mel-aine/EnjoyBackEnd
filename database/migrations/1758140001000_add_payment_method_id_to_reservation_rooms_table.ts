import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('payment_method_id').unsigned().nullable()
      table.foreign('payment_method_id').references('id').inTable('payment_methods').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['payment_method_id'])
      table.dropColumn('payment_method_id')
    })
  }
}