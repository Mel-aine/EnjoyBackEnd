import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('voided_date').nullable()
      table.string('void_reason').nullable()
      table.text('void_notes').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('voided_date')
      table.dropColumn('void_reason')
      table.dropColumn('void_notes')
    })
  }
}