import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'cleaning_statuses'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('room_id').unsigned().notNullable()
      table.integer('hotel_id').unsigned().notNullable()
      table.enum('previous_status', [
        'clean', 'dirty', 'out_of_order', 'inspected', 'maintenance'
      ]).nullable()
      table.enum('current_status', [
        'clean', 'dirty', 'out_of_order', 'inspected', 'maintenance'
      ]).notNullable()
      table.timestamp('status_changed_at').notNullable()
      table.integer('changed_by').unsigned().notNullable()
      table.enum('change_reason', [
        'guest_checkout', 'guest_checkin', 'cleaning_completed', 
        'inspection_passed', 'inspection_failed', 'maintenance_required',
        'maintenance_completed', 'manual_override', 'system_update'
      ]).notNullable()
      table.text('notes').nullable()
      table.json('inspection_details').nullable()
      table.integer('estimated_cleaning_time').nullable() // minutes
      table.integer('actual_cleaning_time').nullable() // minutes
      table.timestamp('cleaning_started_at').nullable()
      table.timestamp('cleaning_completed_at').nullable()
      table.integer('cleaned_by').unsigned().nullable()
      table.timestamp('inspection_started_at').nullable()
      table.timestamp('inspection_completed_at').nullable()
      table.integer('inspected_by').unsigned().nullable()
      table.boolean('inspection_passed').nullable()
      table.json('inspection_checklist').nullable()
      table.text('inspection_notes').nullable()
      table.json('defects_found').nullable()
      table.boolean('requires_maintenance').defaultTo(false)
      table.text('maintenance_notes').nullable()
      table.enum('priority_level', ['low', 'medium', 'high', 'urgent']).defaultTo('medium')
      table.integer('guest_satisfaction_score').nullable() // 1-10
      table.text('guest_feedback').nullable()
      table.json('supplies_used').nullable()
      table.decimal('cleaning_cost', 8, 2).defaultTo(0)
      table.boolean('deep_cleaning_required').defaultTo(false)
      table.date('last_deep_cleaning_date').nullable()
      table.integer('days_since_last_deep_clean').nullable()
      table.json('photos_before').nullable()
      table.json('photos_after').nullable()
      table.string('work_order_number', 50).nullable()
      table.enum('shift', ['morning', 'afternoon', 'evening', 'night']).nullable()
      table.boolean('overtime_required').defaultTo(false)
      table.text('special_instructions').nullable()
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('room_id').references('id').inTable('rooms').onDelete('CASCADE')
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('changed_by').references('id').inTable('users').onDelete('CASCADE')
      table.foreign('cleaned_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('inspected_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['room_id'])
      table.index(['current_status'])
      table.index(['status_changed_at'])
      table.index(['changed_by'])
      table.index(['requires_maintenance'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}