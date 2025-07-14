import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_service_products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('total_adult').nullable().defaultTo(0)
      table.integer('total_children').nullable().defaultTo(0)
      table.decimal('rate_per_night', 15, 2).nullable().defaultTo(0)
      table.decimal('taxes', 15, 2).nullable().defaultTo(0)
      table.decimal('discounts', 15, 2).nullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('total_adult')
      table.dropColumn('total_children')
      table.dropColumn('rate_per_night')
      table.dropColumn('taxes')
      table.dropColumn('discounts')
    })
  }
}