import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('guest_id').unsigned().nullable().after('folio_id')
      table.foreign('guest_id').references('id').inTable('guests').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['guest_id'])
      table.dropColumn('guest_id')
    })
  }
}
