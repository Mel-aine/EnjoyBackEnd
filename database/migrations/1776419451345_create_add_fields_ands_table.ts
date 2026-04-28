
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    
    this.schema.alterTable('guests', (table) => {
      table.decimal('outstanding_credit', 15, 2).defaultTo(0).notNullable()
    })

    this.schema.alterTable('folio_transactions', (table) => {
      table.boolean('is_credit_ledger').defaultTo(false)
    })

    // Table d'audit des mouvements Credit Ledger
    this.schema.createTable('credit_ledger_logs', (table) => {
      table.increments('id')
      table.integer('guest_id').unsigned().references('id').inTable('guests').onDelete('CASCADE')
      table.integer('hotel_id').unsigned().references('id').inTable('hotels')
      table.decimal('amount', 15, 2).notNullable()                
      table.enum('movement_type', ['credit', 'debit']).notNullable()
      table.string('origin_type').notNullable()                    // 'checkout', 'payment', 'manual'
      table.integer('origin_reservation_id').unsigned().nullable().references('id').inTable('reservations').onDelete('CASCADE')
      table.integer('destination_reservation_id').unsigned().nullable().references('id').inTable('reservations').onDelete('CASCADE')
      table.integer('folio_transaction_id').unsigned().nullable().references('id').inTable('folio_transactions').onDelete('CASCADE')
      table.text('notes').nullable()
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.alterTable('guests', (table) => {
      table.dropColumn('outstanding_credit')
    })
    this.schema.alterTable('folio_transactions', (table) => {
      table.dropColumn('is_credit_ledger')
    })
    this.schema.dropTable('credit_ledger_logs')
  }
}