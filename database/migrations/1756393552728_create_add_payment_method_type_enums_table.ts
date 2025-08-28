import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_methods'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the existing enum constraint
      table.dropColumn('method_type')
    })

    this.schema.alterTable(this.tableName, (table) => {
      // Add the updated enum with all PaymentMethodType values
      table.enum('method_type', [
        'cash',
        'credit_card', 
        'debit_card',
        'bank_transfer',
        'check',
        'digital_wallet',
        'cryptocurrency',
        'voucher',
        'loyalty_points',
        'comp',
        'house_account',
        'city_ledger',
        'other'
      ]).notNullable().defaultTo('other')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the updated enum
      table.dropColumn('method_type')
    })

    this.schema.alterTable(this.tableName, (table) => {
      // Restore the original enum
      table.enum('method_type', [
        'cash', 'credit_card', 'debit_card', 'bank_transfer', 
        'check', 'digital_wallet', 'cryptocurrency', 'gift_card',
        'corporate_account', 'comp', 'house_account', 'voucher'
      ]).notNullable()
    })
  }
}