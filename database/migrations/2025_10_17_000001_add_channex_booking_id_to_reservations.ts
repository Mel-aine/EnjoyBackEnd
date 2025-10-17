import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddChannexBookingIdToReservations extends BaseSchema {
  protected tableName = 'reservations'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('channex_booking_id').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('channex_booking_id')
    })
  }
}