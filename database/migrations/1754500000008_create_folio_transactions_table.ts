import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('folio_id').unsigned().notNullable()
      table.integer('reservation_id').unsigned().notNullable()
      table.string('transaction_code', 20).notNullable()
      table.string('transaction_number', 50).unique().notNullable()
      table.enum('transaction_type', [
        'charge', 'payment', 'adjustment', 'refund', 'transfer', 
        'comp', 'void', 'correction', 'tax', 'fee'
      ]).notNullable()
      table.enum('charge_category', [
        'room', 'food_beverage', 'telephone', 'laundry', 'spa', 
        'business_center', 'parking', 'internet', 'minibar', 
        'room_service', 'conference', 'other'
      ]).nullable()
      table.string('description', 500).notNullable()
      table.decimal('amount', 12, 2).notNullable()
      table.decimal('tax_amount', 10, 2).defaultTo(0)
      table.decimal('service_charge', 10, 2).defaultTo(0)
      table.decimal('total_amount', 12, 2).notNullable()
      table.string('currency_code', 3).defaultTo('USD')
      table.decimal('exchange_rate', 10, 6).defaultTo(1)
      table.date('transaction_date').notNullable()
      table.time('transaction_time').notNullable()
      table.date('posting_date').notNullable()
      table.integer('payment_method_id').unsigned().nullable()
      table.string('reference_number', 100).nullable()
      table.string('authorization_code', 50).nullable()
      table.string('receipt_number', 50).nullable()
      table.integer('quantity').defaultTo(1)
      table.decimal('unit_price', 10, 2).nullable()
      table.string('department_code', 20).nullable()
      table.string('revenue_center', 50).nullable()
      table.boolean('is_posted').defaultTo(true)
      table.boolean('is_voided').defaultTo(false)
      table.timestamp('voided_date').nullable()
      table.integer('voided_by').unsigned().nullable()
      table.text('void_reason').nullable()
      table.integer('original_transaction_id').unsigned().nullable()
      table.boolean('is_correction').defaultTo(false)
      table.integer('corrected_transaction_id').unsigned().nullable()
      table.text('correction_reason').nullable()
      table.boolean('is_transferred').defaultTo(false)
      table.integer('transferred_to_folio_id').unsigned().nullable()
      table.timestamp('transferred_date').nullable()
      table.integer('transferred_by').unsigned().nullable()
      table.json('additional_details').nullable()
      table.text('internal_notes').nullable()
      table.boolean('guest_signature_required').defaultTo(false)
      table.boolean('guest_signature_obtained').defaultTo(false)
      table.timestamp('signature_date').nullable()
      table.string('pos_terminal_id', 50).nullable()
      table.string('cashier_id', 50).nullable()
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('folio_id').references('id').inTable('folios').onDelete('CASCADE')
      table.foreign('reservation_id').references('id').inTable('reservations').onDelete('CASCADE')
      table.foreign('voided_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('original_transaction_id').references('id').inTable('folio_transactions').onDelete('SET NULL')
      table.foreign('corrected_transaction_id').references('id').inTable('folio_transactions').onDelete('SET NULL')
      table.foreign('transferred_to_folio_id').references('id').inTable('folios').onDelete('SET NULL')
      table.foreign('transferred_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['folio_id'])
      table.index(['reservation_id'])
      table.index(['transaction_type'])
      table.index(['transaction_date'])
      table.index(['posting_date'])
      table.index(['is_posted'])
      table.index(['is_voided'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}