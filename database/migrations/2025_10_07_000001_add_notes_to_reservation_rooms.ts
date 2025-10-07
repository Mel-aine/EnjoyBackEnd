import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddNotesToReservationRooms extends BaseSchema {
  protected tableName = 'reservation_rooms'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('notes').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('notes')
    })
  }
}