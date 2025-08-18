import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('package_rate').nullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('package_rate')
    })
  }
}