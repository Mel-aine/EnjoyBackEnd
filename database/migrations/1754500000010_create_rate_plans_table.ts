import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rate_plans'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable()
      table.string('plan_name', 100).notNullable()
      table.string('plan_code', 20).notNullable()
      table.text('description').nullable()
      table.enum('rate_type', [
        'standard', 'corporate', 'government', 'group', 'promotional', 
        'package', 'seasonal', 'weekend', 'advance_purchase', 'last_minute'
      ]).notNullable()
      table.enum('calculation_method', [
        'fixed', 'percentage_markup', 'percentage_discount', 'dynamic'
      ]).defaultTo('fixed')
      table.decimal('base_rate', 10, 2).nullable()
      table.decimal('markup_percentage', 5, 4).defaultTo(0)
      table.decimal('discount_percentage', 5, 4).defaultTo(0)
      table.date('effective_from').notNullable()
      table.date('effective_to').nullable()
      table.boolean('is_active').defaultTo(true)
      table.boolean('is_public').defaultTo(true)
      table.boolean('requires_approval').defaultTo(false)
      table.integer('minimum_nights').defaultTo(1)
      table.integer('maximum_nights').nullable()
      table.integer('advance_booking_days').defaultTo(0)
      table.integer('maximum_advance_days').nullable()
      table.json('applicable_days').nullable() // [1,2,3,4,5,6,7] for days of week
      table.json('blackout_dates').nullable()
      table.json('booking_sources').nullable() // which sources can use this rate
      table.json('market_segments').nullable()
      table.json('room_types').nullable() // applicable room types
      table.boolean('includes_breakfast').defaultTo(false)
      table.boolean('includes_wifi').defaultTo(false)
      table.boolean('includes_parking').defaultTo(false)
      table.json('included_amenities').nullable()
      table.text('terms_and_conditions').nullable()
      table.text('cancellation_policy').nullable()
      table.boolean('refundable').defaultTo(true)
      table.decimal('cancellation_fee', 10, 2).defaultTo(0)
      table.integer('free_cancellation_hours').defaultTo(24)
      table.enum('guarantee_required', [
        'none', 'credit_card', 'deposit', 'full_payment'
      ]).defaultTo('none')
      table.decimal('deposit_percentage', 5, 4).defaultTo(0)
      table.decimal('deposit_amount', 10, 2).defaultTo(0)
      table.boolean('auto_apply').defaultTo(false)
      table.integer('priority_level').defaultTo(5)
      table.string('promo_code', 50).nullable()
      table.integer('max_bookings').nullable() // limit total bookings
      table.integer('current_bookings').defaultTo(0)
      table.json('age_restrictions').nullable()
      table.json('occupancy_restrictions').nullable()
      table.text('special_instructions').nullable()
      table.enum('status', ['active', 'inactive', 'expired', 'draft']).defaultTo('active')
      
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
      table.unique(['hotel_id', 'plan_code'])
      
      // Indexes
      table.index(['effective_from', 'effective_to'])
      table.index(['is_active'])
      table.index(['rate_type'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}