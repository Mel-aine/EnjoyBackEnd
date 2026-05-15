import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('whatsapp_enabled').defaultTo(false).nullable()
      table.text('whatsapp_provider_type').nullable()
      table.jsonb('whatsapp_config').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('whatsapp_enabled')
      table.dropColumn('whatsapp_provider_type')
      table.dropColumn('whatsapp_config')
    })
  }
}