import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rooms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable()
      table.integer('room_type_id').unsigned().notNullable()
      table.string('room_number', 20).notNullable()
      table.integer('floor_number').nullable()
      table.string('building_section', 50).nullable()
      table.enum('status', ['available', 'occupied', 'out_of_order', 'maintenance', 'dirty', 'clean']).defaultTo('available')
      table.enum('housekeeping_status', ['clean', 'dirty', 'inspected', 'out_of_order']).defaultTo('clean')
      table.boolean('is_accessible').defaultTo(false)
      table.boolean('has_balcony').defaultTo(false)
      table.boolean('has_kitchen').defaultTo(false)
      table.string('view_type', 50).nullable()
      table.json('special_features').nullable()
      table.text('maintenance_notes').nullable()
      table.timestamp('last_cleaned_at').nullable()
      table.timestamp('last_inspected_at').nullable()
      table.decimal('daily_rate_override', 10, 2).nullable()
      table.boolean('is_blocked').defaultTo(false)
      table.text('block_reason').nullable()
      table.timestamp('blocked_until').nullable()
      table.json('room_amenities').nullable()
      table.text('special_instructions').nullable()
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('room_type_id').references('id').inTable('room_types').onDelete('CASCADE')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Unique constraint
      table.unique(['hotel_id', 'room_number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}