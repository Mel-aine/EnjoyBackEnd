import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'whatsapp_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')
      table.string('guest_phone', 30).notNullable()
      table.timestamp('opened_at', { useTz: true }).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable() // opened_at + 24h

      // Index pour la requête "est-ce que cette session est encore active ?"
      table.index(['hotel_id', 'guest_phone', 'expires_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}