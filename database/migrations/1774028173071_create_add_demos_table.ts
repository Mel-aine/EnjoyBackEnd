import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'request_demos'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.string('city').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('created_by')
      table.dropColumn('city')
    })
  }
}
