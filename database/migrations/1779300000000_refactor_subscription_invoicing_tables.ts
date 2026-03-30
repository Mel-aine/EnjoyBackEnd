import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.dropTableIfExists('invoice_receipts')
    this.schema.dropTableIfExists('invoice_subscriptions')

    this.schema.createTable('invoice_subscriptions', (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')

      table.string('invoice_number').notNullable().unique()
      table.decimal('total_amount', 10, 2).notNullable()
      table.string('currency', 3).notNullable()
      table.enum('status', ['pending', 'paid', 'failed', 'cancelled']).defaultTo('pending')

      table.timestamp('billing_date').notNullable()
      table.timestamp('period_start').notNullable()
      table.timestamp('period_end').notNullable()
      table.timestamp('paid_at').nullable()

      table.integer('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['hotel_id', 'billing_date'])
      table.index(['status'])
    })

    this.schema.createTable('invoice_subscription_items', (table) => {
      table.increments('id')

      table
        .integer('invoice_subscription_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('invoice_subscriptions')
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
      table.timestamp('period_start').notNullable()
      table.timestamp('period_end').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['invoice_subscription_id'])
      table.index(['subscription_id'])
    })

    this.schema.createTable('invoice_subscription_receipts', (table) => {
      table.increments('id')
      table.string('receipt_number').notNullable().unique()

      table
        .integer('invoice_subscription_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('invoice_subscriptions')
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

      table.index(['invoice_subscription_id'])
      table.index(['hotel_id', 'payment_date'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('invoice_subscription_receipts')
    this.schema.dropTableIfExists('invoice_subscription_items')
    this.schema.dropTableIfExists('invoice_subscriptions')
  }
}

