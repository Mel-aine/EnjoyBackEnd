import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'daily_summary_facts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('city_ledger_closing_balance', 15, 2).defaultTo(0)
      table.decimal('guest_ledger_closing_balance', 15, 2).defaultTo(0)
      table.decimal('advance_deposit_ledger_closing_balance', 15, 2).defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('city_ledger_closing_balance')
      table.dropColumn('guest_ledger_closing_balance')
      table.dropColumn('advance_deposit_ledger_closing_balance')
    })
  }
}
