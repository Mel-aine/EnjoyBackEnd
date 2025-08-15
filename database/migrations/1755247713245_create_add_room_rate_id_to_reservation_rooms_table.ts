import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_rates'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('room_rate_id').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
        table.integer('room_rate_id').nullable().alter()
    })
  }
}
