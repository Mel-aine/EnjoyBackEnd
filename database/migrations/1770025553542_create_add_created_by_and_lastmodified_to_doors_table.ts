import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'doors'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('created_by').unsigned().nullable()
        .references('id').inTable('users')
        .onDelete('SET NULL')

      table.integer('last_modified_by').unsigned().nullable()
        .references('id').inTable('users')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('created_by')
      table.dropColumn('last_modified_by')

    })
  }
}
