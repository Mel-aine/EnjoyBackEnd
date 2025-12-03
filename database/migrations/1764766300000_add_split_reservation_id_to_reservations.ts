import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('split_reservation_id').unsigned().nullable()
      table
        .foreign('split_reservation_id')
        .references('id')
        .inTable('reservations')
        .onDelete('SET NULL')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['split_reservation_id'])
      table.dropColumn('split_reservation_id')
    })
  }
}

