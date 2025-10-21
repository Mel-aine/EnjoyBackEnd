import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddGuestSummaryFields extends BaseSchema {
  protected tableName = 'reservations'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('custom_type').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('custom_type')
    })
  }
}
