import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('invoice_subscriptions', (table) => {
      table.jsonb('billing_from').nullable()
    })
  }

  async down() {
    this.schema.alterTable('invoice_subscriptions', (table) => {
      table.dropColumn('billing_from')
    })
  }
}

