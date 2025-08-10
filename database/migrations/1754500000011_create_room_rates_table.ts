import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_rates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable()
      table.integer('room_type_id').unsigned().notNullable()
      table.integer('rate_plan_id').unsigned().notNullable()
      table.date('rate_date').notNullable()
      table.decimal('base_rate', 10, 2).notNullable()
      table.decimal('adult_rate', 10, 2).nullable()
      table.decimal('child_rate', 10, 2).nullable()
      table.decimal('infant_rate', 10, 2).defaultTo(0)
      table.decimal('extra_adult_rate', 10, 2).defaultTo(0)
      table.decimal('extra_child_rate', 10, 2).defaultTo(0)
      table.decimal('single_occupancy_rate', 10, 2).nullable()
      table.decimal('double_occupancy_rate', 10, 2).nullable()
      table.decimal('weekend_rate', 10, 2).nullable()
      table.decimal('holiday_rate', 10, 2).nullable()
      table.decimal('peak_season_rate', 10, 2).nullable()
      table.decimal('off_season_rate', 10, 2).nullable()
      table.integer('minimum_nights').defaultTo(1)
      table.integer('maximum_nights').nullable()
      table.boolean('closed_to_arrival').defaultTo(false)
      table.boolean('closed_to_departure').defaultTo(false)
      table.boolean('stop_sell').defaultTo(false)
      table.integer('available_rooms').nullable()
      table.integer('rooms_sold').defaultTo(0)
      table.decimal('occupancy_percentage', 5, 2).defaultTo(0)
      table.enum('day_type', [
        'weekday', 'weekend', 'holiday', 'peak', 'off_peak', 'special_event'
      ]).defaultTo('weekday')
      table.boolean('is_special_event').defaultTo(false)
      table.string('special_event_name', 200).nullable()
      table.decimal('demand_multiplier', 5, 4).defaultTo(1)
      table.json('restrictions').nullable()
      table.json('booking_rules').nullable()
      table.text('rate_notes').nullable()
      table.boolean('is_published').defaultTo(true)
      table.timestamp('last_updated_by_system').nullable()
      table.boolean('auto_calculated').defaultTo(false)
      table.string('calculation_source', 50).nullable()
      table.json('competitor_rates').nullable()
      table.decimal('revenue_generated', 12, 2).defaultTo(0)
      table.integer('bookings_count').defaultTo(0)
      table.decimal('average_daily_rate', 10, 2).nullable()
      table.decimal('revenue_per_available_room', 10, 2).nullable()
      table.enum('status', ['active', 'inactive', 'archived']).defaultTo('active')
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('room_type_id').references('id').inTable('room_types').onDelete('CASCADE')
      table.foreign('rate_plan_id').references('id').inTable('rate_plans').onDelete('CASCADE')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Unique constraint
      table.unique(['hotel_id', 'room_type_id', 'rate_plan_id', 'rate_date'])
      
      // Indexes
      table.index(['rate_date'])
      table.index(['room_type_id', 'rate_date'])
      table.index(['rate_plan_id', 'rate_date'])
      table.index(['stop_sell'])
      table.index(['closed_to_arrival'])
      table.index(['is_published'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}