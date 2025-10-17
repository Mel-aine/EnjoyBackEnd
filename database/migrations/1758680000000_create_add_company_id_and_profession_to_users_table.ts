import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('company_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('company_accounts')
        .onDelete('SET NULL')

      table.string('profession', 100).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['company_id'])
      table.dropColumn('company_id')
      table.dropColumn('profession')
    })
  }
}