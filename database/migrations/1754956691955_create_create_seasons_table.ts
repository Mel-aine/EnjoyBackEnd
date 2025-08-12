import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'seasons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      
      // Core season fields
      table.integer('hotel_id').unsigned().notNullable()
      table.string('short_code', 50).notNullable()
      table.string('season_name', 255).notNullable()
      
      // Season date range fields
      table.integer('from_day').unsigned().notNullable().checkBetween([1, 31])
      table.integer('from_month').unsigned().notNullable().checkBetween([1, 12])
      table.integer('to_day').unsigned().notNullable().checkBetween([1, 31])
      table.integer('to_month').unsigned().notNullable().checkBetween([1, 12])
      table.date('start_date').notNullable()
      
      // Status field
      table.enum('status', ['active', 'inactive', 'draft']).defaultTo('active')
      
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
      table.index(['hotel_id', 'short_code'])
      table.index(['status'])
      table.index(['is_deleted'])
      table.index(['start_date'])
      
      // Unique constraint for short_code within hotel
      table.unique(['hotel_id', 'short_code'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}