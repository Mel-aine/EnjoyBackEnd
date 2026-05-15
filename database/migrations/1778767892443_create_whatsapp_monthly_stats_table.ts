import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'whatsapp_monthly_stats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('hotel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')

      // Format "2025-01" → un enregistrement par hôtel par mois
      table.string('month', 7).notNullable()

      // Compteur de tous les messages reçus
      table.integer('message_count').unsigned().defaultTo(0).notNullable()

      // Compteur de sessions 24h ouvertes (= ce que Meta facture)
      table.integer('session_count').unsigned().defaultTo(0).notNullable()

      // Un seul enregistrement par hôtel par mois
      table.unique(['hotel_id', 'month'])

      // Index pour les requêtes de comparaison
      table.index(['hotel_id', 'month'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}