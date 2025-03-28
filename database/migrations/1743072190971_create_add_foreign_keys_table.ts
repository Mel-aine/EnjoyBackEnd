import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.alterTable('roles', (table) => {
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('roles', (table) => {
      table.dropForeign('created_by')
      table.dropForeign('last_modified_by')
  })
}
}
