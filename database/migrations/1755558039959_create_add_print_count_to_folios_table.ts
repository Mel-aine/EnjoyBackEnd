import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('print_count').defaultTo(0).notNullable()
      table.dateTime('last_print_date').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('print_count')
      table.dropColumn('last_print_date')
    })
  }
}