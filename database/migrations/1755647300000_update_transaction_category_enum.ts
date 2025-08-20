import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // First, check if the constraint exists and drop it
    await this.db.rawQuery(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_transactions_category_check') THEN
          ALTER TABLE folio_transactions DROP CONSTRAINT folio_transactions_category_check;
        END IF;
      END $$;
    `)
    
    // Add the new check constraint with all TransactionCategory enum values
    await this.db.rawQuery(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_category_check 
      CHECK (category IN (
        'transfer_out', 'transfer_in', 'room', 'food_beverage', 'telephone', 
        'laundry', 'minibar', 'spa', 'business_center', 'parking', 'internet', 
        'miscellaneous', 'package', 'incidental', 'tax', 'service_charge', 
        'deposit', 'payment', 'adjustment', 'no_show_fee', 'void', 'balancing_adjustment'
      ))
    `)
  }

  async down() {
    // Drop the new constraint
    this.schema.raw('ALTER TABLE folio_transactions DROP CONSTRAINT IF EXISTS folio_transactions_category_check')
    
    // Restore the original constraint
    this.schema.raw(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_category_check 
      CHECK (category IN (
        'room', 'food_beverage', 'telephone', 'laundry', 'minibar', 'spa', 
        'business_center', 'parking', 'internet', 'miscellaneous', 'package', 
        'incidental', 'tax', 'service_charge', 'deposit', 'payment', 'adjustment'
      ))
    `)
  }
}