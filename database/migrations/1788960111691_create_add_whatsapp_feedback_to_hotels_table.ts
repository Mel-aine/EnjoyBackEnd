// database/migrations/xxxx_add_whatsapp_feedback_to_hotels.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('whatsapp_feedback_enabled').defaultTo(false)
      table.integer('whatsapp_feedback_delay_hours').defaultTo(2)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('whatsapp_feedback_enabled')
      table.dropColumn('whatsapp_feedback_delay_hours')
    })
  }
}
