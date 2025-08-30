import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('reservation_id').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('reservation_id').notNullable().alter()
    })
  }
}