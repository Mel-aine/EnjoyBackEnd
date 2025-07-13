import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('booking_source').nullable()
      table.dateTime('check_in_date').nullable()
      table.dateTime('check_out_date').nullable()
      table.integer('number_of_nights').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('booking_source')
      table.dropColumn('check_in_date')
      table.dropColumn('check_out_date')
      table.dropColumn('number_of_nights')
    })
  }
}