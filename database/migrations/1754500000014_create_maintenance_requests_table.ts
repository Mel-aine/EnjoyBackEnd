import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'maintenance_requests'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable()
      table.integer('room_id').unsigned().nullable()
      table.string('request_number', 50).notNullable().unique()
      table.string('title', 200).notNullable()
      table.text('description').notNullable()
      table.enum('category', [
        'plumbing', 'electrical', 'hvac', 'furniture', 'appliances',
        'bathroom', 'bedroom', 'general', 'safety', 'security',
        'technology', 'cleaning', 'painting', 'flooring', 'windows',
        'doors', 'lighting', 'other'
      ]).notNullable()
      table.enum('priority', ['low', 'medium', 'high', 'urgent', 'emergency']).notNullable()
      table.enum('status', [
        'open', 'assigned', 'in_progress', 'on_hold', 'completed',
        'cancelled', 'deferred', 'waiting_parts', 'waiting_approval'
      ]).defaultTo('open')
      table.integer('reported_by').unsigned().notNullable()
      table.timestamp('reported_date').notNullable()
      table.enum('reported_by_type', [
        'guest', 'housekeeping', 'maintenance', 'front_desk', 'management', 'other'
      ]).notNullable()
      table.integer('assigned_to').unsigned().nullable()
      table.timestamp('assigned_date').nullable()
      table.timestamp('due_date').nullable()
      table.timestamp('started_date').nullable()
      table.timestamp('completed_date').nullable()
      table.integer('completed_by').unsigned().nullable()
      table.text('work_performed').nullable()
      table.text('resolution_notes').nullable()
      table.json('parts_used').nullable()
      table.decimal('labor_cost', 10, 2).defaultTo(0)
      table.decimal('parts_cost', 10, 2).defaultTo(0)
      table.decimal('total_cost', 10, 2).defaultTo(0)
      table.integer('estimated_hours').nullable()
      table.integer('actual_hours').nullable()
      table.boolean('requires_room_closure').defaultTo(false)
      table.timestamp('room_closure_start').nullable()
      table.timestamp('room_closure_end').nullable()
      table.boolean('affects_guest_stay').defaultTo(false)
      table.text('guest_impact_notes').nullable()
      table.boolean('warranty_work').defaultTo(false)
      table.string('warranty_provider', 100).nullable()
      table.string('warranty_number', 100).nullable()
      table.boolean('recurring_issue').defaultTo(false)
      table.integer('related_request_id').unsigned().nullable()
      table.json('before_photos').nullable()
      table.json('after_photos').nullable()
      table.text('preventive_measures').nullable()
      table.date('next_inspection_date').nullable()
      table.enum('approval_required', ['none', 'supervisor', 'manager', 'owner']).defaultTo('none')
      table.integer('approved_by').unsigned().nullable()
      table.timestamp('approved_date').nullable()
      table.text('approval_notes').nullable()
      table.boolean('emergency_response').defaultTo(false)
      table.timestamp('response_time').nullable()
      table.integer('guest_satisfaction_rating').nullable() // 1-5
      table.text('guest_feedback').nullable()
      table.string('vendor_name', 100).nullable()
      table.string('vendor_contact', 100).nullable()
      table.string('work_order_number', 50).nullable()
      table.json('inspection_checklist').nullable()
      table.boolean('quality_check_passed').nullable()
      table.integer('quality_checked_by').unsigned().nullable()
      table.timestamp('quality_check_date').nullable()
      table.text('quality_check_notes').nullable()
      table.json('follow_up_required').nullable()
      table.date('follow_up_date').nullable()
      table.text('internal_notes').nullable()
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('room_id').references('id').inTable('rooms').onDelete('SET NULL')
      table.foreign('reported_by').references('id').inTable('users').onDelete('CASCADE')
      table.foreign('assigned_to').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('completed_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('quality_checked_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('related_request_id').references('id').inTable('maintenance_requests').onDelete('SET NULL')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['status'])
      table.index(['priority'])
      table.index(['category'])
      table.index(['assigned_to'])
      table.index(['due_date'])
      table.index(['reported_date'])
      table.index(['room_id'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}