import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // Ensure category constraint includes 'discount'
    await this.db.rawQuery(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_transactions_category_check') THEN
          ALTER TABLE folio_transactions DROP CONSTRAINT folio_transactions_category_check;
        END IF;
      END $$;
    `)

    await this.db.rawQuery(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_category_check 
      CHECK (category IN (
        'posting', 'transfer_out', 'transfer_in', 'room', 'food_beverage', 'telephone', 
        'laundry', 'minibar', 'spa', 'business_center', 'parking', 'internet', 
        'miscellaneous', 'package', 'incidental', 'tax', 'service_charge', 
        'deposit', 'payment', 'adjustment', 'discount', 'no_show_fee', 'cancellation_fee',
        'early_departure_fee', 'late_checkout_fee', 'extra_bed', 'city_tax',
        'resort_fee', 'void', 'refund', 'extract_charge', 'balancing_adjustment'
      ))
    `)
  }

  async down() {
    // Revert: remove 'discount' from category constraint
    await this.db.rawQuery(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_transactions_category_check') THEN
          ALTER TABLE folio_transactions DROP CONSTRAINT folio_transactions_category_check;
        END IF;
      END $$;
    `)

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
  }
}