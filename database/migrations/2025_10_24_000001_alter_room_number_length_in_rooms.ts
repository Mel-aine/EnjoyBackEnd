import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AlterRoomNumberLengthInRooms extends BaseSchema {
  protected tableName = 'rooms'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('room_number', 100).notNullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('room_number', 20).notNullable().alter()
    })
  }
}