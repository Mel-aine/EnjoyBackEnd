import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'production_options'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('value').nullable()

    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('value')
    })
  }
}
