import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'company_accounts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Renommer billing_address_line1 en billing_address_line
      table.renameColumn('billing_address_line1', 'billing_address_line')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Renommer billing_address_line en billing_address_line1
      table.renameColumn('billing_address_line', 'billing_address_line1')
    })
  }
}