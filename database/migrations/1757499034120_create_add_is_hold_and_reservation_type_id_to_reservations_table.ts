import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add isHold field
      table.boolean('is_hold').defaultTo(false)
      
      // Add reservation_type_id as foreign key
      table.integer('reservation_type_id').unsigned().nullable()
      table.foreign('reservation_type_id').references('id').inTable('reservation_types')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['reservation_type_id'])
      table.dropColumn('reservation_type_id')
      table.dropColumn('is_hold')
    })
  }
}