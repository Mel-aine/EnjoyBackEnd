import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tax_rates'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('rate_percentage')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('rate_percentage', 5, 2).notNullable()
    })
  }
}