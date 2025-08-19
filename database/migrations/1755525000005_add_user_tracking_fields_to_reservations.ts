import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('checked_in_by').unsigned().nullable().references('id').inTable('users')
      table.integer('checked_out_by').unsigned().nullable().references('id').inTable('users')
      table.integer('reserved_by').unsigned().nullable().references('id').inTable('users')
      // cancelled_by already exists from previous migration
      table.integer('voided_by').unsigned().nullable().references('id').inTable('users')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('checked_in_by')
      table.dropColumn('checked_out_by')
      table.dropColumn('reserved_by')
      // cancelled_by should not be dropped as it existed before this migration
      table.dropColumn('voided_by')
    })
  }
}