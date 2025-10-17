import BaseSchema from '@adonisjs/lucid/schema'

export default class AddGuestSummaryFields extends BaseSchema {
  protected tableName = 'guests'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('first_reservation_id').unsigned().nullable()
      table.integer('last_reservation_id').unsigned().nullable()
      table.timestamp('first_arrival_date', { useTz: true }).nullable()
      table.timestamp('last_arrival_date', { useTz: true }).nullable()

      table
        .foreign('first_reservation_id')
        .references('id')
        .inTable('reservations')
        .onDelete('SET NULL')

      table
        .foreign('last_reservation_id')
        .references('id')
        .inTable('reservations')
        .onDelete('SET NULL')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign('first_reservation_id')
      table.dropForeign('last_reservation_id')
      table.dropColumn('first_reservation_id')
      table.dropColumn('last_reservation_id')
      table.dropColumn('first_arrival_date')
      table.dropColumn('last_arrival_date')
    })
  }
}