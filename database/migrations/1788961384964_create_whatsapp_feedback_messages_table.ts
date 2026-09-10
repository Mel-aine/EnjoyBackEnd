
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'whatsapp_feedback_messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE')
      table.integer('reservation_id').unsigned().references('id').inTable('reservations').onDelete('CASCADE')
      table.integer('guest_id').unsigned().references('id').inTable('guests').onDelete('CASCADE').nullable()
      table.string('guest_name').notNullable()
      table.string('guest_phone').notNullable()

      table.timestamp('scheduled_at').notNullable()
      table.enum('status', ['pending', 'sent', 'cancelled']).defaultTo('pending')
      table.timestamp('sent_at').nullable()
      table.integer('sent_by').unsigned().references('id').inTable('users').nullable()
      table.index(['hotel_id', 'status']) // pour la liste du header (pending par hôtel)
      table.index(['scheduled_at'])
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
