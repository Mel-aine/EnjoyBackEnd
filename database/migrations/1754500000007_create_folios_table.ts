import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('reservation_id').unsigned().notNullable()
      table.integer('guest_id').unsigned().notNullable()
      table.string('folio_number', 50).unique().notNullable()
      table.enum('folio_type', ['master', 'split', 'group', 'individual']).defaultTo('master')
      table.string('folio_name', 200).notNullable()
      table.decimal('total_charges', 12, 2).defaultTo(0)
      table.decimal('total_payments', 12, 2).defaultTo(0)
      table.decimal('total_adjustments', 12, 2).defaultTo(0)
      table.decimal('balance', 12, 2).defaultTo(0)
      table.decimal('credit_limit', 10, 2).defaultTo(0)
      table.enum('status', ['open', 'closed', 'transferred', 'disputed']).defaultTo('open')
      table.enum('payment_method', [
        'cash', 'credit_card', 'debit_card', 'bank_transfer', 
        'check', 'corporate_account', 'comp', 'house_account'
      ]).nullable()
      table.string('reference_number', 100).nullable()
      table.text('billing_instructions').nullable()
      table.json('billing_address').nullable()
      table.string('tax_id', 50).nullable()
      table.boolean('auto_post_room_charges').defaultTo(true)
      table.boolean('auto_post_tax').defaultTo(true)
      table.boolean('credit_limit_exceeded').defaultTo(false)
      table.timestamp('last_posted_charge').nullable()
      table.timestamp('closed_date').nullable()
      table.integer('closed_by').unsigned().nullable()
      table.text('closing_notes').nullable()
      table.decimal('final_balance', 12, 2).nullable()
      table.boolean('printed').defaultTo(false)
      table.timestamp('printed_date').nullable()
      table.integer('printed_by').unsigned().nullable()
      table.boolean('emailed').defaultTo(false)
      table.timestamp('emailed_date').nullable()
      table.string('email_address', 255).nullable()
      table.json('payment_history').nullable()
      table.text('special_instructions').nullable()
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('reservation_id').references('id').inTable('reservations').onDelete('CASCADE')
      table.foreign('guest_id').references('id').inTable('guests').onDelete('CASCADE')
      table.foreign('closed_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('printed_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['reservation_id'])
      table.index(['guest_id'])
      table.index(['status'])
      table.index(['folio_type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}