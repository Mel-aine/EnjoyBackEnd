import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rate_type_room_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('rate_type_id').unsigned().notNullable()
      table.integer('room_type_id').unsigned().notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Foreign key constraints
      table.foreign('rate_type_id').references('id').inTable('rate_types').onDelete('CASCADE')
      table.foreign('room_type_id').references('id').inTable('room_types').onDelete('CASCADE')

      // Unique constraint to prevent duplicate relationships
      table.unique(['rate_type_id', 'room_type_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}