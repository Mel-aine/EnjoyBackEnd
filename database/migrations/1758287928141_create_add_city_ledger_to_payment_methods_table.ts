import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddCityLedgerToPaymentMethods extends BaseSchema {
  protected tableName = 'payment_methods'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add 'CITY_LEDGER' to the 'type' enum column
      table.enum('type', [
        'CASH',
        'CREDIT_CARD',
        'BANK_TRANSFER',
        'MOBILE_PAYMENT',
        'CITY_LEDGER', // New value
      ]).notNullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Remove 'CITY_LEDGER' from the 'type' enum column
      table.enum('type', [
        'CASH',
        'CREDIT_CARD',
        'BANK_TRANSFER',
        'MOBILE_PAYMENT',
      ]).notNullable().alter()
    })
  }
}