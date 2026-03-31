import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('invoice_subscriptions', (table) => {
      table.boolean('is_sent').notNullable().defaultTo(false)
      table.index(['hotel_id', 'is_sent'])
    })
  }

  async down() {
    this.schema.alterTable('invoice_subscriptions', (table) => {
      table.dropIndex(['hotel_id', 'is_sent'])
      table.dropColumn('is_sent')
    })
  }
}

