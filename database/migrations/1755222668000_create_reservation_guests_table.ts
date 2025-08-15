import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_guests'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('reservation_id').unsigned().references('id').inTable('reservations').onDelete('CASCADE')
      table.integer('guest_id').unsigned().references('id').inTable('guests').onDelete('CASCADE')
      table.boolean('is_primary').defaultTo(false)
      table.enum('guest_type', ['adult', 'child', 'infant']).defaultTo('adult')
      table.integer('room_assignment').unsigned().nullable()
      table.text('special_requests').nullable()
      table.text('dietary_restrictions').nullable()
      table.text('accessibility').nullable()
      table.string('emergency_contact', 255).nullable()
      table.string('emergency_phone', 50).nullable()
      table.text('notes').nullable()
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('last_modified_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Add a unique constraint to prevent duplicate entries
      table.unique(['reservation_id', 'guest_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}