import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Modifier la colonne pour la rendre nullable
      table.string('table').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Revenir à NOT NULL (avec une valeur par défaut pour éviter les erreurs)
      table.string('table').notNullable().defaultTo('').alter()
    })
  }
}