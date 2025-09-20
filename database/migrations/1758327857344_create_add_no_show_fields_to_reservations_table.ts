import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddNoShowFieldsToReservations extends BaseSchema {
  protected tableName = 'reservations'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add the new fields
      table.string('no_show_reason', 255).nullable() // Reason for no-show
      table.decimal('no_show_fees', 10, 2).nullable() // Fees for no-show
      table.integer('mark_no_show_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL') // User who marked the no-show
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the fields in case of rollback
      table.dropColumn('no_show_reason')
      table.dropColumn('no_show_fees')
      table.dropColumn('mark_no_show_by')
    })
  }
}