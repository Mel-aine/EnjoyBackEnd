import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'whatsapp_scheduled_messages'

  async up() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'invoice_url')

    if (!hasColumn) {
      await this.schema.alterTable(this.tableName, (table) => {
        table.string('invoice_url').nullable()
      })
    }
  }

  async down() {
    await this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('invoice_url')
    })
  }
}