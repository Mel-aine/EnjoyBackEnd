import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Flags to mark origin/destination in room moves
      table.boolean('is_splited_origin').defaultTo(false)
      table.boolean('isplited_destinatination').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_splited_origin')
      table.dropColumn('isplited_destinatination')
    })
  }
}
