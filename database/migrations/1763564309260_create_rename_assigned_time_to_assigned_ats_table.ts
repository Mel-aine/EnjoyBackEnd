import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'support_tickets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Supprimer l'ancienne colonne
      table.dropColumn('assigned_time')
      
      // Créer la nouvelle colonne avec le type datetime
      table.datetime('assigned_at')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Supprimer la nouvelle colonne
      table.dropColumn('assigned_at')
      
      // Recréer l'ancienne colonne avec son type original
      table.string('assignedTime') // Remplacez 'string' par l'ancien type si différent
    })
  }
}