import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // Update TransactionCategory constraint with all enum values
    await this.db.rawQuery(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_transactions_category_check') THEN
          ALTER TABLE folio_transactions DROP CONSTRAINT folio_transactions_category_check;
        END IF;
      END $$;
    `)
    
    // Add the updated TransactionCategory constraint with all enum values
    await this.db.rawQuery(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_category_check 
      CHECK (category IN (
        'posting', 'transfer_out', 'transfer_in', 'room', 'food_beverage', 'telephone', 
        'laundry', 'minibar', 'spa', 'business_center', 'parking', 'internet', 
        'miscellaneous', 'package', 'incidental', 'tax', 'service_charge', 
        'deposit', 'payment', 'adjustment', 'no_show_fee', 'cancellation_fee',
        'early_departure_fee', 'late_checkout_fee', 'extra_bed', 'city_tax',
        'resort_fee', 'void', 'refund', 'extract_charge', 'balancing_adjustment'
      ))
    `)

    // Add TransactionType constraint (if it doesn't exist)
    await this.db.rawQuery(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_transactions_transaction_type_check') THEN
          ALTER TABLE folio_transactions 
          ADD CONSTRAINT folio_transactions_transaction_type_check 
          CHECK (transaction_type IN (
            'charge', 'payment', 'adjustment', 'tax', 'discount', 'refund', 
            'transfer', 'void', 'correction', 'room_posting'
          ));
        END IF;
      END $$;
    `)
  }

  async down() {
    // Drop the updated constraints
    this.schema.raw('ALTER TABLE folio_transactions DROP CONSTRAINT IF EXISTS folio_transactions_category_check')
    this.schema.raw('ALTER TABLE folio_transactions DROP CONSTRAINT IF EXISTS folio_transactions_transaction_type_check')
    
    // Restore the original TransactionCategory constraint (without new values)
    this.schema.raw(`
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
}