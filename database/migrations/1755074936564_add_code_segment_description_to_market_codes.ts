import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'market_codes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('code').notNullable().after('name')
      table.string('segment').notNullable().after('code')
      table.text('description').nullable().after('segment')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('code')
      table.dropColumn('segment')
      table.dropColumn('description')
    })
  }
}