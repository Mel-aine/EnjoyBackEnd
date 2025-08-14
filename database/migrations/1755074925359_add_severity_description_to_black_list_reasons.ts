import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'black_list_reasons'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('severity', ['High', 'Medium', 'Low']).notNullable().after('category')
      table.text('description').nullable().after('severity')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('severity')
      table.dropColumn('description')
    })
  }
}