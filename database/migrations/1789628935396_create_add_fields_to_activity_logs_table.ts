
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('reservation_id').unsigned().references('id').inTable('reservations').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('reservation_id')
    })
  }
}
