import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_user_assignments'

   async up() {
    this.schema.alterTable(this.tableName, (table) => {
        table.integer('hotel_id').unsigned().nullable() // <- nullable d'abord
            .references('id').inTable('hotels')
            .onDelete('CASCADE')

    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('hotel_id')
    })
  }
}
