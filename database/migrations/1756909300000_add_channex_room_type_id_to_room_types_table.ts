import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('channex_room_type_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('channex_room_type_id')
    })
  }
}