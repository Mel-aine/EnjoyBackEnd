import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'amenities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      // Core amenity fields
      table.string('amenity_name', 255).notNullable()
      table.string('amenity_type', 100).notNullable()
      table.integer('sort_key').defaultTo(0).comment('Sort order for display')
      
      // Hotel relationship
      table.integer('hotel_id').unsigned().notNullable()
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      
      // Enhanced traceability and compliance fields
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.integer('created_by_user_id').unsigned().nullable()
      table.foreign('created_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      
      table.timestamp('updated_at').notNullable().defaultTo(this.now())
      table.integer('updated_by_user_id').unsigned().nullable()
      table.foreign('updated_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      
      // Soft deletion fields
      table.boolean('is_deleted').defaultTo(false).notNullable()
      table.timestamp('deleted_at').nullable()
      
      // Indexes for better performance
      table.index(['hotel_id', 'is_deleted'])
      table.index(['amenity_type', 'is_deleted'])
      table.index(['sort_key'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}