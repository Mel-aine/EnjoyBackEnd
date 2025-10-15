import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('extra_charge_id').unsigned().nullable()
      table
        .foreign('extra_charge_id')
        .references('id')
        .inTable('extra_charges')
        .onDelete('SET NULL')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['extra_charge_id'])
      table.dropColumn('extra_charge_id')
    })
  }
}