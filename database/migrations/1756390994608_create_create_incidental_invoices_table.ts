import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'incidental_invoices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      
      // Foreign keys
      table.integer('hotel_id').unsigned().notNullable()
      table.integer('folio_id').unsigned().notNullable()
      table.integer('guest_id').unsigned().notNullable()
      
      // Invoice details
      table.string('invoice_number').notNullable()
      table.dateTime('invoice_date').notNullable()
      
      // Financial fields
      table.decimal('total_amount', 12, 2).notNullable().defaultTo(0)
      table.decimal('tax_amount', 10, 2).notNullable().defaultTo(0)
      table.decimal('service_charge_amount', 10, 2).notNullable().defaultTo(0)
      table.decimal('discount_amount', 10, 2).notNullable().defaultTo(0)
      table.decimal('net_amount', 12, 2).notNullable().defaultTo(0)
      
      // Currency
      table.string('currency_code', 3).notNullable().defaultTo('USD')
      table.decimal('exchange_rate', 10, 6).notNullable().defaultTo(1.0)
      table.decimal('base_currency_amount', 12, 2).notNullable().defaultTo(0)
      
      // Payment information
      table.integer('payment_method_id').unsigned().nullable()
      table.string('payment_type').nullable()
      
      // Status and type
      table.enum('status', ['draft', 'issued', 'paid', 'cancelled', 'voided']).notNullable().defaultTo('draft')
      table.string('type').notNullable().defaultTo('Voice Incidence')
      
      // Description and notes
      table.text('description').nullable()
      table.text('notes').nullable()
      table.text('internal_notes').nullable()
      
      // References
      table.string('reference').nullable()
      table.string('external_reference').nullable()
      
      // Billing information
      table.json('billing_address').nullable()
      table.json('billing_contact').nullable()
      
      // Charges and details
      table.json('charges').notNullable() // Array of charge items
      table.json('tax_details').nullable() // Tax breakdown
      table.json('payment_details').nullable() // Payment information
      
      // Payment tracking
      table.dateTime('due_date').nullable()
      table.dateTime('paid_date').nullable()
      table.decimal('paid_amount', 12, 2).notNullable().defaultTo(0)
      table.decimal('outstanding_amount', 12, 2).notNullable().defaultTo(0)
      
      // Print and email tracking
      table.boolean('printed').notNullable().defaultTo(false)
      table.dateTime('printed_date').nullable()
      table.integer('printed_by').unsigned().nullable()
      table.boolean('emailed').notNullable().defaultTo(false)
      table.dateTime('emailed_date').nullable()
      table.string('email_address').nullable()
      
      // Void information
      table.text('void_reason').nullable()
      table.dateTime('voided_date').nullable()
      table.integer('voided_by').unsigned().nullable()
      
      // Audit fields
      table.integer('created_by').unsigned().notNullable()
      table.integer('last_modified_by').unsigned().notNullable()
      
      table.timestamp('created_at')
      table.timestamp('updated_at')
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('folio_id').references('id').inTable('folios').onDelete('CASCADE')
      table.foreign('guest_id').references('id').inTable('guests').onDelete('CASCADE')
      table.foreign('payment_method_id').references('id').inTable('payment_methods').onDelete('SET NULL')
      table.foreign('created_by').references('id').inTable('users').onDelete('RESTRICT')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('RESTRICT')
      table.foreign('printed_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('voided_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['hotel_id'])
      table.index(['folio_id'])
      table.index(['guest_id'])
      table.index(['invoice_number'])
      table.index(['invoice_date'])
      table.index(['status'])
      table.index(['type'])
      table.index(['created_at'])
      table.index(['hotel_id', 'invoice_date'])
      table.index(['hotel_id', 'status'])
      table.index(['folio_id', 'status'])
      
      // Unique constraints
      table.unique(['hotel_id', 'invoice_number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}