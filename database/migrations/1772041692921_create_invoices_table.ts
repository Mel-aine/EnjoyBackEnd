import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().references('id').inTable('hotels')
      table.decimal('amount', 10, 2)
      table.string('currency').defaultTo('EUR')
      table.enum('status', ['pending', 'paid', 'failed', 'cancelled']).defaultTo('pending')
      table.string('invoice_number').notNullable().unique()
      table.string('description').nullable()
      table.timestamp('billing_date')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}