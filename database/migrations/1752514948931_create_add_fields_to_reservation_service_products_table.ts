import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_service_products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // useTz: true stores the timestamp with timezone
      table.timestamp('check_in_date', { useTz: true }).nullable()
      table.timestamp('check_out_date', { useTz: true }).nullable()
      table.string('status').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('check_in_date')
      table.dropColumn('check_out_date')
      table.dropColumn('status')
    })
  }
}
