import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotel_whatsapp_templates'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['hotel_id'])
      table.dropColumn('hotel_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hotel_id').unsigned().notNullable()
      table.foreign('hotel_id').references('hotels.id').onDelete('CASCADE')
    })
  }
}