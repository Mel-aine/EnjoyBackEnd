import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('reservation_room_id').unsigned().nullable().after('reservation_id')
      
      // Add foreign key constraint
      table.foreign('reservation_room_id').references('id').inTable('reservation_rooms').onDelete('SET NULL')
      
      // Add index
      table.index(['reservation_room_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['reservation_room_id'])
      table.dropIndex(['reservation_room_id'])
      table.dropColumn('reservation_room_id')
    })
  }
}