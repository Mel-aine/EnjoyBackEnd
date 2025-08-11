import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bed_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('short_code', 10).notNullable().unique()
      table.string('bed_type_name', 100).notNullable()
      table.integer('hotel_id').unsigned().notNullable()
      
      // Enhanced traceability fields
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.integer('created_by_user_id').unsigned().notNullable()
      table.timestamp('updated_at').notNullable().defaultTo(this.now())
      table.integer('updated_by_user_id').unsigned().notNullable()
      table.boolean('is_deleted').defaultTo(false)
      table.timestamp('deleted_at').nullable()
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('created_by_user_id').references('id').inTable('users')
      table.foreign('updated_by_user_id').references('id').inTable('users')
      
      // Indexes
      table.index(['hotel_id', 'is_deleted'])
      table.index('short_code')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}