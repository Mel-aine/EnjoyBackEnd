import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'whatsapp_scheduled_messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('invoice_url').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
     table.dropColumn('invoice_url')
    })
  }
}