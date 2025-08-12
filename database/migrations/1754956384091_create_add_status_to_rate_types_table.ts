import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rate_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('status', ['active', 'inactive', 'draft']).defaultTo('active').after('room_type_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
    })
  }
}