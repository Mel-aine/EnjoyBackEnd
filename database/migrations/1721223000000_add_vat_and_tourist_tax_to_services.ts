import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('vat_hospitality', 5, 2).nullable().after('checkout_hours')
      table.decimal('general_vat', 5, 2).nullable().after('vat_hospitality')
      table.integer('tourist_tax').nullable().after('general_vat')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('vat_hospitality')
      table.dropColumn('general_vat')
      table.dropColumn('tourist_tax')
    })
  }
}
