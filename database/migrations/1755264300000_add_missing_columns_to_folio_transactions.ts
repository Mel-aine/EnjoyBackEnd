import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add only the most essential missing columns that are causing the error
      table.decimal('discount_amount', 10, 2).nullable()
      table.decimal('discount_rate', 5, 4).nullable()
      table.decimal('net_amount', 12, 2).nullable()
      table.decimal('gross_amount', 12, 2).nullable()
      table.decimal('service_charge_amount', 10, 2).nullable()
      table.decimal('service_charge_rate', 5, 4).nullable()
      table.dateTime('service_date').nullable()
      table.string('external_reference').nullable()
      table.enum('status', ['pending', 'posted', 'voided', 'transferred', 'disputed', 'refunded']).defaultTo('pending')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('discount_amount')
      table.dropColumn('discount_rate')
      table.dropColumn('net_amount')
      table.dropColumn('gross_amount')
      table.dropColumn('service_charge_amount')
      table.dropColumn('service_charge_rate')
      table.dropColumn('service_date')
      table.dropColumn('external_reference')
      table.dropColumn('status')
    })
  }
}