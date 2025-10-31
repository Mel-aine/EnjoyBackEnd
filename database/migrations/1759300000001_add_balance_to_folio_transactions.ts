import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('balance', 12, 2).nullable().comment('Folio balance after posting this transaction')
      table.index(['balance'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['balance'])
      table.dropColumn('balance')
    })
  }
}