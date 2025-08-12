import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('registration_no_1', 255).nullable()
      table.string('registration_no_2', 255).nullable()
      table.string('registration_no_3', 255).nullable()
      table.text('cancellation_policy').nullable()
      table.text('hotel_policy').nullable()
      table.string('property_type', 100).nullable()
      table.text('address_2').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('registration_no_1')
      table.dropColumn('registration_no_2')
      table.dropColumn('registration_no_3')
      table.dropColumn('cancellation_policy')
      table.dropColumn('hotel_policy')
      table.dropColumn('property_type')
      table.dropColumn('address_2')
    })
  }
}