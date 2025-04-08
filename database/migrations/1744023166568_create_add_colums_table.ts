import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'options'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Ajouter la colonne `is_default` de type boolean avec la valeur par défaut `false`
      table.boolean('is_default').defaultTo(false).notNullable()

      // Ajouter la colonne `type` avec des valeurs possibles : `picklist`, `text`, `number`
      table.enum('type', ['picklist', 'text', 'number']).defaultTo('text').notNullable()

    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Supprimer les colonnes `is_default` et `type`
      table.dropColumn('is_default')
      table.dropColumn('type')
    })
  }
}
