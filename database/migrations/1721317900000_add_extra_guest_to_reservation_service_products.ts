import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_service_products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('extra_guest').nullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('extra_guest')
    })
  }
}