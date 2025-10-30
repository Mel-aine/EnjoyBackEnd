import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_methods'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('company_id').unsigned().nullable()
      table
        .foreign('company_id')
        .references('id')
        .inTable('company_accounts')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['company_id'])
      table.dropColumn('company_id')
    })
  }
}