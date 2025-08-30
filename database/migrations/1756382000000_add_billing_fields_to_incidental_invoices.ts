import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'incidental_invoices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add individual billing fields
      table.string('billing_name', 200).nullable()
      table.string('billing_city', 100).nullable()
      table.string('billing_state', 100).nullable()
      table.string('billing_zip', 20).nullable()
      table.string('billing_country', 100).nullable()
      
      // Add email invoice flag
      table.boolean('email_invoice').notNullable().defaultTo(false)
      
      // Add reference number field
      table.string('reference_number', 100).nullable()
      
      // Modify billing_address to be a string instead of JSON
      table.string('billing_address', 500).nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('billing_name')
      table.dropColumn('billing_city')
      table.dropColumn('billing_state')
      table.dropColumn('billing_zip')
      table.dropColumn('billing_country')
      table.dropColumn('email_invoice')
      table.dropColumn('reference_number')
      
      // Revert billing_address back to JSON
      table.json('billing_address').nullable().alter()
    })
  }
}