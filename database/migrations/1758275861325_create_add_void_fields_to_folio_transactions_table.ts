import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddVoidFieldsToFolioTransactions extends BaseSchema {
  protected tableName = 'folio_transactions'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add the new columns
      table.timestamp('voided_at', { useTz: true }).nullable() // Date and time of voiding
      table.text('notes').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the columns and foreign key
      table.dropColumn('voided_at')
      table.dropColumn('notes')
    })
  }
}