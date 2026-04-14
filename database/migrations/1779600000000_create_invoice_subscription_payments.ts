import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('invoice_subscription_payments', (table) => {
      table.increments('id')

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
    this.schema.dropTableIfExists('invoice_subscription_payments')
  }
}

