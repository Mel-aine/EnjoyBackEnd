import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'guests'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('last_name', 100).nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('last_name', 100).notNullable().alter()
    })
  }
}
