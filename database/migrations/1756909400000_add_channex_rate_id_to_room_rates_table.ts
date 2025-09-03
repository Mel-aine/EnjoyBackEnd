import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_rates'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('channex_rate_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('channex_rate_id')
    })
  }
}