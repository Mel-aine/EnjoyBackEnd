import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // Drop l'ancienne contrainte (qu'elle existe ou non)
    await this.db.rawQuery(`
      ALTER TABLE folio_transactions 
      DROP CONSTRAINT IF EXISTS folio_transactions_transaction_type_check;
    `)

    // Recrée avec les nouvelles valeurs incluant credit_ledger_*
    await this.db.rawQuery(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_transaction_type_check 
      CHECK (transaction_type IN (
        'charge', 'payment', 'adjustment', 'tax', 'discount', 'refund',
        'transfer', 'void', 'correction', 'room_posting',
        'credit_ledger_payment', 'credit_ledger_transfer'
      ));
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE folio_transactions 
      DROP CONSTRAINT IF EXISTS folio_transactions_transaction_type_check;
    `)

    // Restaure la contrainte originale sans les types credit_ledger
    await this.db.rawQuery(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_transaction_type_check 
      CHECK (transaction_type IN (
        'charge', 'payment', 'adjustment', 'tax', 'discount', 'refund',
        'transfer', 'void', 'correction', 'room_posting'
      ));
    `)
  }
}