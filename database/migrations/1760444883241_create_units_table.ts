import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'units'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Relationships
      table
        .integer('hotel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')

      // Core fields
      table.string('name', 150).notNullable()

      // Audit fields
      table.integer('created_by_user_id').unsigned().nullable()
      table.integer('updated_by_user_id').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // Soft delete
      table.boolean('is_deleted').defaultTo(false)
      table.timestamp('deleted_at', { useTz: true }).nullable()

      // Foreign keys for audit
      table
        .foreign('created_by_user_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .foreign('updated_by_user_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      // Indexes
      table.index(['hotel_id', 'name'], 'idx_units_hotel_name')
      table.index(['is_deleted'], 'idx_units_is_deleted')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}