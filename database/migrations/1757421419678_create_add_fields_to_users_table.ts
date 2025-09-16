import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('state_province', 100).nullable()
      table.text('company_name').nullable()
      table.string('postal_code', 20).nullable()
      table.string('fax').nullable()
      table.string('registration_number').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('state_province')
      table.dropColumn('postal_code')
      table.dropColumn('fax')
      table.dropColumn('registration_number')
      table.dropColumn('company_name')

    })
  }
}
