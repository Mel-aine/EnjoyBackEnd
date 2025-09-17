import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add new user relationship fields
      table.integer('reserved_by_user').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('voided_by_user').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('mark_no_show_by_user').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')

      // Add indexes for better query performance
      table.index('reserved_by_user')
      table.index('voided_by_user')
      table.index('mark_no_show_by_user')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop indexes first
      table.dropIndex('reserved_by_user')
      table.dropIndex('voided_by_user')
      table.dropIndex('mark_no_show_by_user')

      // Drop columns
      table.dropColumn('reserved_by_user')
      table.dropColumn('voided_by_user')
      table.dropColumn('mark_no_show_by_user')
    })
  }
}