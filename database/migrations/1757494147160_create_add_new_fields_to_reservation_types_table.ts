import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_hold').nullable()
      table.enum('status', ['active', 'inactive']).nullable()
      table.enum('reservation_status', ['confirmed', 'pending']).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_hold')
      table.dropColumn('status')
      table.dropColumn('reservation_status')
    })
  }
}