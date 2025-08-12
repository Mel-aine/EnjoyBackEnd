import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reasons'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('status', ['active', 'inactive']).defaultTo('active').after('reason_name')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
    })
  }
}