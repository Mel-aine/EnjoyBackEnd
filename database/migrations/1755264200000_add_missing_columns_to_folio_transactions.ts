import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add the missing 'category' column that the model expects
      table.enum('category', [
        'room', 'food_beverage', 'telephone', 'laundry', 'minibar', 'spa', 
        'business_center', 'parking', 'internet', 'miscellaneous', 'package', 
        'incidental', 'tax', 'service_charge', 'deposit', 'payment', 'adjustment'
      ]).nullable().after('transaction_type')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('category')
    })
  }
}