import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('formula_setting').nullable()
      table.json('document_numbering_setting').nullable()
      table.json('print_email_settings').nullable()
      table.json('checkin_reservation_settings').nullable()
      table.json('display_settings').nullable()
      table.json('registration_settings').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('formula_setting')
      table.dropColumn('document_numbering_setting')
      table.dropColumn('print_email_settings')
      table.dropColumn('checkin_reservation_settings')
      table.dropColumn('display_settings')
      table.dropColumn('registration_settings')
    })
  }
}