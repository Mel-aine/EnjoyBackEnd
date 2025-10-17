import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddTransportFieldsToReservationRooms extends BaseSchema {
  protected tableName = 'reservation_rooms'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('arriving_to').nullable()
      table.string('going_to').nullable()
      table.string('means_of_transportation').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('arriving_to')
      table.dropColumn('going_to')
      table.dropColumn('means_of_transportation')
    })
  }
}