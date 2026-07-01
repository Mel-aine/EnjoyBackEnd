import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'lost_found'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hotel_id').unsigned().nullable().references('id').inTable('hotels').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('hotel_id')
    })
  }
}