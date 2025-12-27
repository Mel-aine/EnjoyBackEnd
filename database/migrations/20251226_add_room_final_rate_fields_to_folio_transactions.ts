import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('room_final_rate', 12, 2).nullable()
      table.decimal('room_final_rate_taxe', 12, 2).nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('room_final_rate')
      table.dropColumn('room_final_rate_taxe')
    })
  }
}
