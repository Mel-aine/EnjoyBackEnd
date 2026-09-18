import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Who should collect the payment: 'property', 'ota' or null
      table.string('payment_collect', 50).nullable()
      // OTA commission details (text) - applicable for Booking.com and Airbnb
      table.text('ota_commission').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('payment_collect')
      table.dropColumn('ota_commission')
    })
  }
}
