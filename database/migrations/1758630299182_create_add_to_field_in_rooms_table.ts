import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddNoShowFieldsToReservations extends BaseSchema {
  protected tableName = 'rooms'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('housekeeping_remarks').nullable()
      table.integer('assigned_housekeeper_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL').defaultTo(null)
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the fields in case of rollback

      table.dropColumn('housekeeping_remarks')
      table.dropColumn('assigned_housekeeper_id')
    })
  }
}
