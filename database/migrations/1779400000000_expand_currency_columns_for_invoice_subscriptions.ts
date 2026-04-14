import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('invoice_subscriptions', (table) => {
      table.string('currency', 10).notNullable().alter()
    })

    this.schema.alterTable('invoice_subscription_receipts', (table) => {
      table.string('currency', 10).notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable('invoice_subscription_receipts', (table) => {
      table.string('currency', 3).notNullable().alter()
    })

    this.schema.alterTable('invoice_subscriptions', (table) => {
      table.string('currency', 3).notNullable().alter()
    })
  }
}

