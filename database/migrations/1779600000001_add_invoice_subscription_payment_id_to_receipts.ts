import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('invoice_subscription_receipts', (table) => {
      table
        .integer('invoice_subscription_payment_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('invoice_subscription_payments')
        .onDelete('SET NULL')

      table.index(['invoice_subscription_payment_id'])
    })
  }

  async down() {
    this.schema.alterTable('invoice_subscription_receipts', (table) => {
      table.dropIndex(['invoice_subscription_payment_id'])
      table.dropColumn('invoice_subscription_payment_id')
    })
  }
}

