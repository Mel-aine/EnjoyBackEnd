// database/migrations/XXXX_create_whatsapp_logs_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'whatsapp_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')
      table.integer('reservation_id').unsigned().nullable().references('id').inTable('reservations').onDelete('SET NULL')
      table.string('meta_message_id').nullable().index()
      table.enum('status', ['sent', 'delivered', 'read', 'failed','received']).notNullable().defaultTo('sent')
      table.string('template_name').nullable()
      table.string('recipient_phone').nullable()
      table.text('message_body').nullable()
      table.string('provider').notNullable().defaultTo('meta')
      table.decimal('cost', 10, 6).nullable()            
      table.string('credential_source').nullable()       
      table.json('provider_response').nullable()          
      table.string('failure_reason').nullable()
      table.timestamp('sent_at').nullable()
      table.timestamp('delivered_at').nullable()
      table.timestamp('read_at').nullable()
      table.timestamp('failed_at').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}