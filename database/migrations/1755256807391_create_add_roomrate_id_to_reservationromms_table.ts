import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('room_rate_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
        table.integer('room_rate_id').nullable()
    })
  }
}
