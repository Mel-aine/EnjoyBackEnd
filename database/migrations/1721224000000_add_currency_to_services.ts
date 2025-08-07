import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('currency', ['XAF', 'EUR', 'USD', 'GBP', 'CHF', 'CAD']).nullable().after('tourist_tax')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('currency')
    })
  }
}