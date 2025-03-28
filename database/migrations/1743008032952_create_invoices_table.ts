import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('payment_id').unsigned().references('id').inTable('payments').onDelete('CASCADE')
      table.string('invoice_number', 255).notNullable()
      table.timestamp('date').notNullable()
      table.float('total_amount').notNullable()
      table.string('pdf_link', 255).notNullable() // Lien vers la facture PDF
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
