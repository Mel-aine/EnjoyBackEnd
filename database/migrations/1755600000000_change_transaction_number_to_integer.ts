import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // First, get all existing records and update them with sequential numbers
    const transactions = await this.db.from('folio_transactions').orderBy('id')
    
    for (let i = 0; i < transactions.length; i++) {
      await this.db.from('folio_transactions')
        .where('id', transactions[i].id)
        .update({ transaction_number: (i + 1).toString() })
    }
    
    this.schema.alterTable(this.tableName, (table) => {
      // First, drop the unique constraint on transaction_number
      table.dropUnique(['transaction_number'])
      
      // Change transaction_number from string to integer
      table.integer('transaction_number').unsigned().notNullable().alter()
      
      // Add back the unique constraint
      table.unique(['transaction_number'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the unique constraint
      table.dropUnique(['transaction_number'])
      
      // Change transaction_number back to string
      table.string('transaction_number', 50).unique().notNullable().alter()
    })
  }
}