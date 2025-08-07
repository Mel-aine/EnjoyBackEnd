import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('stars').nullable().after('price')
      table.string('checkin_hours').nullable().after('stars')
      table.string('checkout_hours').nullable().after('checkin_hours')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('stars')
      table.dropColumn('checkin_hours')
      table.dropColumn('checkout_hours')
    })
  }
}
