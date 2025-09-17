import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('reservation_id').unsigned().notNullable()
      table.integer('room_id').unsigned().nullable() // NULL until room is assigned
      table.integer('room_type_id').unsigned().notNullable()
      table.date('check_in_date').notNullable()
      table.date('check_out_date').notNullable()
      table.integer('nights').notNullable()
      table.integer('adults').defaultTo(1)
      table.integer('children').defaultTo(0)
      table.integer('infants').defaultTo(0)
      table.decimal('room_rate', 10, 2).notNullable()
      table.decimal('total_room_charges', 10, 2).notNullable()
      table.decimal('extra_charges', 10, 2).defaultTo(0)
      table.decimal('discounts', 10, 2).defaultTo(0)
      table.decimal('taxes', 10, 2).defaultTo(0)
      table.decimal('total_amount', 10, 2).notNullable()
      table.enum('status', [
        'reserved', 'confirmed', 'checked_in', 'checked_out', 
        'cancelled', 'no_show', 'moved'
      ]).defaultTo('reserved')
      table.json('room_preferences').nullable()
      table.json('guest_preferences').nullable()
      table.text('special_requests').nullable()
      table.text('internal_notes').nullable()
      table.timestamp('actual_check_in').nullable()
      table.timestamp('actual_check_out').nullable()
      table.integer('checked_in_by').unsigned().nullable()
      table.integer('checked_out_by').unsigned().nullable()
      table.boolean('early_check_in').defaultTo(false)
      table.boolean('late_check_out').defaultTo(false)
      table.decimal('early_check_in_fee', 10, 2).defaultTo(0)
      table.decimal('late_check_out_fee', 10, 2).defaultTo(0)
      table.text('room_condition_notes').nullable()
      table.json('amenities_used').nullable()
      table.decimal('incidental_charges', 10, 2).defaultTo(0)
      table.boolean('room_ready').defaultTo(false)
      table.timestamp('room_ready_time').nullable()
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('reservation_id').references('id').inTable('reservations').onDelete('CASCADE')
      table.foreign('room_id').references('id').inTable('rooms').onDelete('SET NULL')
      table.foreign('room_type_id').references('id').inTable('room_types').onDelete('CASCADE')
      table.foreign('checked_in_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('checked_out_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['reservation_id'])
      table.index(['room_id'])
      table.index(['check_in_date', 'check_out_date'])
      table.index(['status'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}