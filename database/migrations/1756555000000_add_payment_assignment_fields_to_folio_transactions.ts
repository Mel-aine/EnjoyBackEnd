import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add payment assignment tracking fields
      table.decimal('assigned_amount', 12, 2).defaultTo(0).comment('Amount assigned to invoices/charges')
      table.decimal('unassigned_amount', 12, 2).defaultTo(0).comment('Amount not yet assigned')
      table.json('assignment_history').nullable().comment('History of payment assignments')
      table.string('voucher').nullable().comment('Voucher number for payment reference')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('assigned_amount')
      table.dropColumn('unassigned_amount')
      table.dropColumn('assignment_history')
      table.dropColumn('voucher')
    })
  }
}