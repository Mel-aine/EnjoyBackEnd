import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('room_final_base_rate', 12, 0).nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('room_final_base_rate')
    })
  }
}

