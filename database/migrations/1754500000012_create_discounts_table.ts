import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'discounts'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable()
      table.string('discount_name', 100).notNullable()
      table.string('discount_code', 20).notNullable()
      table.text('description').nullable()
      table.enum('discount_type', [
        'percentage', 'fixed_amount', 'free_nights', 'upgrade', 
        'early_bird', 'last_minute', 'extended_stay', 'group', 
        'corporate', 'loyalty', 'seasonal', 'promotional'
      ]).notNullable()
      table.decimal('discount_value', 10, 2).notNullable()
      table.enum('value_type', ['percentage', 'fixed', 'nights']).notNullable()
      table.decimal('maximum_discount', 10, 2).nullable()
      table.decimal('minimum_order_value', 10, 2).defaultTo(0)
      table.date('valid_from').notNullable()
      table.date('valid_to').nullable()
      table.boolean('is_active').defaultTo(true)
      table.boolean('is_public').defaultTo(true)
      table.boolean('requires_code').defaultTo(false)
      table.string('promo_code', 50).nullable()
      table.integer('usage_limit').nullable()
      table.integer('usage_count').defaultTo(0)
      table.integer('usage_limit_per_customer').nullable()
      table.integer('minimum_nights').defaultTo(1)
      table.integer('maximum_nights').nullable()
      table.integer('advance_booking_days').defaultTo(0)
      table.json('applicable_room_types').nullable()
      table.json('applicable_rate_plans').nullable()
      table.json('applicable_booking_sources').nullable()
      table.json('applicable_days').nullable() // days of week
      table.json('blackout_dates').nullable()
      table.json('market_segments').nullable()
      table.enum('combinable_with_other_discounts', [
        'none', 'all', 'specific'
      ]).defaultTo('none')
      table.json('combinable_discount_ids').nullable()
      table.boolean('auto_apply').defaultTo(false)
      table.integer('priority_level').defaultTo(5)
      table.enum('guest_eligibility', [
        'all', 'new_guests', 'returning_guests', 'vip', 'corporate', 'group'
      ]).defaultTo('all')
      table.json('age_restrictions').nullable()
      table.json('occupancy_requirements').nullable()
      table.text('terms_and_conditions').nullable()
      table.text('marketing_message').nullable()
      table.string('image_url', 500).nullable()
      table.boolean('featured').defaultTo(false)
      table.integer('sort_order').defaultTo(0)
      table.json('tracking_parameters').nullable()
      table.decimal('revenue_impact', 12, 2).defaultTo(0)
      table.integer('bookings_generated').defaultTo(0)
      table.decimal('average_booking_value', 10, 2).defaultTo(0)
      table.decimal('conversion_rate', 5, 4).defaultTo(0)
      table.text('internal_notes').nullable()
      table.enum('approval_status', [
        'draft', 'pending_approval', 'approved', 'rejected'
      ]).defaultTo('draft')
      table.integer('approved_by').unsigned().nullable()
      table.timestamp('approved_date').nullable()
      table.text('approval_notes').nullable()
      table.enum('status', ['active', 'inactive', 'expired', 'suspended']).defaultTo('active')
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Unique constraint
      table.unique(['hotel_id', 'discount_code'])
      
      // Indexes
      table.index(['valid_from', 'valid_to'])
      table.index(['is_active'])
      table.index(['promo_code'])
      table.index(['discount_type'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}