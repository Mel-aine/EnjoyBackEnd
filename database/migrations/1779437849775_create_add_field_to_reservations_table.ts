import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('whatsapp_notification_enable').defaultTo(false)
      table.string('whatsapp_number').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('whatsapp_notification_enable')
      table.dropColumn('whatsapp_number')
    })
  }
}