import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddOriginalCurrencyFieldsToReservationRooms extends BaseSchema {
  protected tableName = 'reservation_rooms'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('original_currency_code').nullable()
      table.float('original_exchange_rate').nullable()
      table.float('original_room_rate').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('original_currency_code')
      table.dropColumn('original_exchange_rate')
      table.dropColumn('original_room_rate')
    })
  }
}