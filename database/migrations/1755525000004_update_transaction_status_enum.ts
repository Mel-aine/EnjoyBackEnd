import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // Drop the existing check constraint
    this.schema.raw('ALTER TABLE folio_transactions DROP CONSTRAINT IF EXISTS folio_transactions_status_check')
    
    // Add the new check constraint with all TransactionStatus enum values
    this.schema.raw(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_status_check 
      CHECK (status IN (
        'pending', 'posted', 'voided', 'transferred', 'disputed', 
        'refunded', 'write_off', 'correction', 'completed', 'failed', 'cancelled'
      ))
    `)
  }

  async down() {
    // Drop the new constraint
    this.schema.raw('ALTER TABLE folio_transactions DROP CONSTRAINT IF EXISTS folio_transactions_status_check')
    
    // Restore the original constraint
    this.schema.raw(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_status_check 
      CHECK (status IN ('pending', 'posted', 'voided', 'transferred', 'disputed', 'refunded'))
    `)
  }
}