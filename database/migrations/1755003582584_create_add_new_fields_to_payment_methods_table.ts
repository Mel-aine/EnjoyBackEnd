import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_methods'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add new required fields
      table.string('short_code', 10).notNullable().defaultTo('') // Short name of the payment method
      table.enum('type', ['CASH', 'BANK']).notNullable().defaultTo('CASH') // Payment type: CASH or BANK
      table.boolean('card_processing').defaultTo(false) // If this is a card payment type
      
      // Surcharge Settings
      table.boolean('surcharge_enabled').defaultTo(false) // Enable surcharge for card transactions
      table.enum('surcharge_type', ['amount', 'percent']).nullable() // Surcharge calculation type
      table.decimal('surcharge_value', 10, 4).nullable() // Surcharge value (amount or percentage)
      table.integer('extra_charge_id').unsigned().nullable() // Reference to extra charge for surcharge
      
      // Receipt Number Settings
      table.enum('receipt_no_setting', ['auto_general', 'auto_private', 'manual']).defaultTo('auto_general') // Receipt number generation type
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Remove the added fields
      table.dropColumn('short_code')
      table.dropColumn('type')
      table.dropColumn('card_processing')
      table.dropColumn('surcharge_enabled')
      table.dropColumn('surcharge_type')
      table.dropColumn('surcharge_value')
      table.dropColumn('extra_charge_id')
      table.dropColumn('receipt_no_setting')
    })
  }
}