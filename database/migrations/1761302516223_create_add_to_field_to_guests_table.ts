
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'guests'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('contact_type_value').nullable()
      table.text('email_secondary').nullable()



    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {

      table.dropColumn('contact_type_value')
      table.dropColumn('email_secondary')


    })
  }
}
