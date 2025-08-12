import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transportation_modes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().notNullable()
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      
      // Audit fields
      table.timestamp('created_at').notNullable()
      table.integer('created_by_user_id').unsigned().nullable()
      table.timestamp('updated_at').notNullable()
      table.integer('updated_by_user_id').unsigned().nullable()
      table.boolean('is_deleted').defaultTo(false)
      table.timestamp('deleted_at').nullable()
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('created_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('updated_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['hotel_id'])
      table.index(['is_deleted'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}