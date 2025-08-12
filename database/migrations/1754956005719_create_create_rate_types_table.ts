import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rate_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      
      // Core fields
      table.integer('hotel_id').unsigned().notNullable()
      table.string('short_code', 50).notNullable()
      table.string('rate_type_name', 255).notNullable()
      table.integer('nights').unsigned().notNullable().defaultTo(1)
      table.integer('max_adult').unsigned().notNullable().defaultTo(2)
      table.integer('min_night').unsigned().notNullable().defaultTo(1)
      table.integer('room_type_id').unsigned().nullable()
      
      // Audit fields
      table.datetime('created_at').notNullable()
      table.integer('created_by_user_id').unsigned().nullable()
      table.datetime('updated_at').notNullable()
      table.integer('updated_by_user_id').unsigned().nullable()
      table.boolean('is_deleted').defaultTo(false)
      table.datetime('deleted_at').nullable()
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('room_type_id').references('id').inTable('room_types').onDelete('SET NULL')
      table.foreign('created_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('updated_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['hotel_id'])
      table.index(['room_type_id'])
      table.index(['is_deleted'])
      table.unique(['hotel_id', 'short_code'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}