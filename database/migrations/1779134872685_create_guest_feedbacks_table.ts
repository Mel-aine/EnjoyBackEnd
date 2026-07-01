import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'guest_feedbacks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
    table.increments('id').primary()
    table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')
    table.integer('reservation_id').unsigned().nullable().references('id').inTable('reservations').onDelete('SET NULL')
    table.integer('guest_id').unsigned().nullable().references('id').inTable('guests').onDelete('SET NULL')
    table.string('phone_number').notNullable()
    // 'excellent' | 'satisfaisant' | 'a_ameliorer'
    table.string('rating').notNullable()
    // Rempli uniquement pour le cas B (commentaire libre)
    table.text('comment').nullable()
    // wa_message_id du survey pour retrouver le contexte via WhatsappLog
    table.string('survey_wa_message_id').nullable()
    table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}