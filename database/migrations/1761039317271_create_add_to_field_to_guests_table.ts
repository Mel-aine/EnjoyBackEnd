import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddGuestSummaryFields extends BaseSchema {
  protected tableName = 'guests'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('maiden_name').nullable()
      table.text('contact_type').nullable()



    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {

      table.dropColumn('maiden_name')
      table.dropColumn('contact_type')


    })
  }
}
