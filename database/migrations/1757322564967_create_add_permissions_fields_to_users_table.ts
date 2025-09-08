import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('permis_discounts').nullable()
      table.text('permis_privileges').nullable()
      table.text('permis_reports').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('permis_discounts')
      table.dropColumn('permis_privileges')
      table.dropColumn('permis_reports')
    })
  }
}