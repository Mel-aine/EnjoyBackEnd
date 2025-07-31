import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'amenity_products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Pour le modèle de tarification : 'flat_rate' (Forfaitaire) ou 'time_based' (Basé sur le temps)
      table.enum('pricing_model', ['flat_rate', 'time_based']).defaultTo('flat_rate').notNullable()

      // Pour l'unité de temps, applicable seulement si pricing_model est 'time_based'
      table.enum('time_unit', ['hour', 'day']).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('pricing_model')
      table.dropColumn('time_unit')
    })
  }
}

