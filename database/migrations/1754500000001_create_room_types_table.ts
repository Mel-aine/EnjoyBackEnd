import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable()
      table.string('type_name', 100).notNullable()
      table.string('type_code', 20).notNullable()
      table.text('description').nullable()
      table.integer('max_occupancy').notNullable()
      table.integer('max_adults').notNullable()
      table.integer('max_children').defaultTo(0)
      table.decimal('base_rate', 10, 2).notNullable()
      table.decimal('size_sqm', 8, 2).nullable()
      table.integer('bed_count').defaultTo(1)
      table.string('bed_type', 50).nullable()
      table.json('amenities').nullable()
      table.json('features').nullable()
      table.string('view_type', 50).nullable()
      table.boolean('smoking_allowed').defaultTo(false)
      table.boolean('pet_friendly').defaultTo(false)
      table.enum('status', ['active', 'inactive', 'maintenance']).defaultTo('active')
      table.json('images').nullable()
      table.text('cancellation_policy').nullable()
      table.integer('sort_order').defaultTo(0)
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Unique constraint
      table.unique(['hotel_id', 'type_code'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}