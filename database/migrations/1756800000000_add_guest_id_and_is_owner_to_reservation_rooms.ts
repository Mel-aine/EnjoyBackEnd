import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('guest_id').unsigned().nullable().after('reservation_id')
      table.boolean('is_owner').defaultTo(false).after('guest_id')
      
      // Add foreign key constraint
      table.foreign('guest_id').references('id').inTable('guests').onDelete('SET NULL')
      
      // Add index
      table.index(['guest_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['guest_id'])
      table.dropIndex(['guest_id'])
      table.dropColumn('guest_id')
      table.dropColumn('is_owner')
    })
  }
}