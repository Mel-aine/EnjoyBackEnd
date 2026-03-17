import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'add_ons'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('name').nullable()
    })

    this.schema.raw(`UPDATE ${this.tableName} SET name = 'Unnamed Add-on' WHERE name IS NULL;`)

    this.schema.alterTable(this.tableName, (table) => {
      table.string('name').notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('name')
    })
  }
}
