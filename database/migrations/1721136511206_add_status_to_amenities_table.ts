import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'amenities'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('status', 50).notNullable().defaultTo('active').after('sort_key')
      table.index('status')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex('status')
      table.dropColumn('status')
    })
  }
}