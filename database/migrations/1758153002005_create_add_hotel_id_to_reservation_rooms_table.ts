import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hotel_id').unsigned().nullable().after('id')
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['hotel_id'])
      table.dropColumn('hotel_id')
    })
  }
}