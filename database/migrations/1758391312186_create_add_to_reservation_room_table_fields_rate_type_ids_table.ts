import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddNoShowFieldsToReservations extends BaseSchema {
  protected tableName = 'reservation_rooms'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('rate_type_id').unsigned().nullable().references('id').inTable('rate_types').onDelete('SET NULL') // User who marked the no-show
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the fields in case of rollback
 
      table.dropColumn('rate_type_id')
    })
  }
}