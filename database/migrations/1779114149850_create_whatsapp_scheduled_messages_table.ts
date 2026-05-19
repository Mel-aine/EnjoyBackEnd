
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'whatsapp_scheduled_messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')
      table.integer('reservation_id').unsigned().nullable().references('id').inTable('reservations').onDelete('SET NULL')
      table.integer('guest_id').nullable()
      table.string('template_name').nullable()       // 'feedback_survey'
      table.string('recipient_phone').nullable()
      table.string('recipient_name').nullable()
      table.string('hotel_name').notNullable()
      table.timestamp('send_after').nullable()        // now + 2h
      table.timestamp('sent_at').nullable()
      table.string('status').defaultTo('pending')       // pending | sent | failed
      table.text('failure_reason').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}