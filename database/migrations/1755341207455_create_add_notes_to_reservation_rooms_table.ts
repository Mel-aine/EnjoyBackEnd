import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('notes').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('notes')
    })
  }
}