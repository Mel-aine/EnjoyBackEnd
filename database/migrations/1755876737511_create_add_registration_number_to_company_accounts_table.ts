import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'company_accounts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('registration_number', 50).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('registration_number')
    })
  }
}