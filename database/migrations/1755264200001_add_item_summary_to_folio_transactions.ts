import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add nullable JSON field to store POS item summary
      table.json('item_summary').nullable().after('additional_details')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('item_summary')
    })
  }
}