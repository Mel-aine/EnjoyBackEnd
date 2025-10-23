import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Ajouter la colonne table de type string
      table.string('table')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Supprimer la colonne en cas de rollback
      table.dropColumn('table')
    })
  }
}