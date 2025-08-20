import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('no_show_fees', 10, 2).nullable().comment('Fees charged for no-show reservations')
      table.integer('mark_no_show_by').unsigned().nullable().references('id').inTable('users').comment('User who marked the reservation as no-show')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('no_show_fees')
      table.dropColumn('mark_no_show_by')
    })
  }
}