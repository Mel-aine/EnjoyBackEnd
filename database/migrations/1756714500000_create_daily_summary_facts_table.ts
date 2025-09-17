import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'daily_summary_facts'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.date('audit_date').primary()
      table.integer('hotel_id').unsigned().notNullable()
      
      // Revenue Fields
      table.decimal('total_room_revenue', 12, 2).defaultTo(0)
      table.decimal('total_food_beverage_revenue', 12, 2).defaultTo(0)
      table.decimal('total_miscellaneous_revenue', 12, 2).defaultTo(0)
      table.decimal('total_taxes', 12, 2).defaultTo(0)
      table.decimal('total_resort_fees', 12, 2).defaultTo(0)
      table.decimal('total_revenue', 12, 2).defaultTo(0)
      table.decimal('total_payments', 12, 2).defaultTo(0)
      table.decimal('total_discounts', 12, 2).defaultTo(0)
      
      // Occupancy Fields
      table.integer('occupied_rooms').defaultTo(0)
      table.integer('total_available_rooms').defaultTo(0)
      table.decimal('occupancy_rate', 5, 2).defaultTo(0) // Percentage
      table.decimal('rev_par', 12, 2).defaultTo(0) // Revenue Per Available Room
      table.decimal('adr', 12, 2).defaultTo(0) // Average Daily Rate
      
      // Guest Activity Fields
      table.integer('num_checked_in').defaultTo(0)
      table.integer('num_checked_out').defaultTo(0)
      table.integer('num_no_shows').defaultTo(0)
      table.integer('num_cancellations').defaultTo(0)
      table.integer('num_bookings_made').defaultTo(0)
      
      // Financial Fields
      table.decimal('total_payments_received', 12, 2).defaultTo(0)
      table.decimal('total_accounts_receivable', 12, 2).defaultTo(0)
      table.integer('total_outstanding_folios').defaultTo(0)
      table.decimal('total_outstanding_folios_balance', 12, 2).defaultTo(0)
      
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraint
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      
      // Index for performance
      table.index(['hotel_id', 'audit_date'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}