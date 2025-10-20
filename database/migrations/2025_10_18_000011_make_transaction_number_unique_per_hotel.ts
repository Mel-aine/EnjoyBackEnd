import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop global unique constraint on transaction_number
      table.dropUnique(['transaction_number'])
      // Add composite unique constraint per hotel
      table.unique(['hotel_id', 'transaction_number'])
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop composite unique constraint
      table.dropUnique(['hotel_id', 'transaction_number'])
      // Restore global unique on transaction_number
      table.unique(['transaction_number'])
    })
  }
}