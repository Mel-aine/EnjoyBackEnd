import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('invoice_subscriptions', (table) => {
      table.increments('id')
      table
        .integer('invoice_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('invoices')
        .onDelete('CASCADE')
      table
        .integer('subscription_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('subscriptions')
        .onDelete('CASCADE')

      table.decimal('line_amount', 10, 2).notNullable()
      table.string('description').nullable()
      table.timestamp('period_start').nullable()
      table.timestamp('period_end').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['invoice_id', 'subscription_id'])
      table.index(['invoice_id'])
      table.index(['subscription_id'])
    })

    this.schema.createTable('invoice_receipts', (table) => {
      table.increments('id')
      table.string('receipt_number').notNullable().unique()

      table
        .integer('invoice_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('invoices')
        .onDelete('CASCADE')

      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')
      table.decimal('amount', 10, 2).notNullable()
      table.string('currency', 3).notNullable()
      table.timestamp('payment_date').notNullable()
      table.string('payment_method').nullable()
      table.string('transaction_reference').nullable()
      table.text('notes').nullable()

      table.integer('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['invoice_id'])
      table.index(['hotel_id', 'payment_date'])
    })
  }

  async down() {
    this.schema.dropTable('invoice_receipts')
    this.schema.dropTable('invoice_subscriptions')
  }
}

