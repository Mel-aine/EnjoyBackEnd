import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // Drop existing checks if present
    await this.db.rawQuery(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_transactions_category_check') THEN
          ALTER TABLE ${this.tableName} DROP CONSTRAINT folio_transactions_category_check;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_transactions_transaction_type_check') THEN
          ALTER TABLE ${this.tableName} DROP CONSTRAINT folio_transactions_transaction_type_check;
        END IF;
      END $$;
    `)

    // Recreate category check aligned with TransactionCategory enum values
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT folio_transactions_category_check 
      CHECK (category IN (
        'posting', 'transfer_out', 'transfer_in', 'room', 'food_beverage', 'telephone', 
        'laundry', 'minibar', 'spa', 'business_center', 'parking', 'internet', 
        'miscellaneous', 'package', 'incidental', 'tax', 'service_charge', 
        'deposit', 'payment', 'adjustment', 'discount', 'no_show_fee', 'cancellation_fee',
        'early_departure_fee', 'late_checkout_fee', 'extra_bed', 'city_tax',
        'resort_fee', 'void', 'refund', 'extract_charge'
      ));
    `)

    // Recreate transaction_type check aligned with TransactionType enum values
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT folio_transactions_transaction_type_check 
      CHECK (transaction_type IN (
        'charge', 'payment', 'adjustment', 'tax', 'discount', 'refund', 
        'transfer', 'void', 'correction', 'room_posting'
      ));
    `)
  }

  async down() {
    // Safely drop the added constraints
    await this.db.rawQuery(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_transactions_category_check') THEN
          ALTER TABLE ${this.tableName} DROP CONSTRAINT folio_transactions_category_check;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_transactions_transaction_type_check') THEN
          ALTER TABLE ${this.tableName} DROP CONSTRAINT folio_transactions_transaction_type_check;
        END IF;
      END $$;
    `)
  }
}