import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'business_sources'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('color').nullable().after('market_code_id')
      table.string('registration_number').nullable().after('color')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('color')
      table.dropColumn('registration_number')
    })
  }
}