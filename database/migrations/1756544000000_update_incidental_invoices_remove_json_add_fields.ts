import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'incidental_invoices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Remove JSON columns
      table.dropColumn('charges')
      table.dropColumn('tax_details')
      table.dropColumn('payment_details')
      
      // Add new fields
      table.string('payment_method').nullable()
      table.string('payment_type').nullable().alter() // This already exists, just making sure it's string
      table.decimal('amount', 12, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Remove new fields
      table.dropColumn('payment_method')
      table.dropColumn('amount')
      
      // Restore JSON columns
      table.json('charges').notNullable() // Array of charge items
      table.json('tax_details').nullable() // Tax breakdown
      table.json('payment_details').nullable() // Payment information
    })
  }
}