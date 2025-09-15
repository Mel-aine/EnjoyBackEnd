import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.alterTable('roles', (table) => {
      table.integer('hotel_id').unsigned().nullable().references('id').inTable('hotels').onDelete('CASCADE')
      table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('last_modified_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')

    })
  }

  async down() {
    this.schema.alterTable('roles', (table) => {
      table.dropForeign('created_by')
      table.dropForeign('last_modified_by')
      table.dropForeign('hotel_id')
  })
}
}
