import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      DROP CONSTRAINT IF EXISTS folio_transactions_category_check
    `)

    await this.db.rawQuery(`
      UPDATE ${this.tableName}
      SET category = CASE
        WHEN category = 'balancing_adjustment' THEN 'adjustment'
        ELSE 'miscellaneous'
      END
      WHERE category IS NOT NULL
        AND category NOT IN (
          'posting',
          'transfer_out',
          'transfer_in',
          'room',
          'food_beverage',
          'telephone',
          'laundry',
          'minibar',
          'spa',
          'business_center',
          'parking',
          'internet',
          'miscellaneous',
          'package',
          'incidental',
          'tax',
          'service_charge',
          'deposit',
          'payment',
          'adjustment',
          'discount',
          'no_show_fee',
          'cancellation_fee',
          'early_departure_fee',
          'late_checkout_fee',
          'extra_bed',
          'city_tax',
          'resort_fee',
          'void',
          'refund',
          'extract_charge',
          'credit_ledger'
        )
    `)

    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT folio_transactions_category_check
      CHECK (category IN (
        'posting',
        'transfer_out',
        'transfer_in',
        'room',
        'food_beverage',
        'telephone',
        'laundry',
        'minibar',
        'spa',
        'business_center',
        'parking',
        'internet',
        'miscellaneous',
        'package',
        'incidental',
        'tax',
        'service_charge',
        'deposit',
        'payment',
        'adjustment',
        'discount',
        'no_show_fee',
        'cancellation_fee',
        'early_departure_fee',
        'late_checkout_fee',
        'extra_bed',
        'city_tax',
        'resort_fee',
        'void',
        'refund',
        'extract_charge',
        'credit_ledger'
      ))
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      DROP CONSTRAINT IF EXISTS folio_transactions_category_check
    `)

    await this.db.rawQuery(`
      UPDATE ${this.tableName}
      SET category = 'miscellaneous'
      WHERE category IN ('extract_charge', 'credit_ledger')
         OR (category IS NOT NULL AND category NOT IN (
          'posting',
          'transfer_out',
          'transfer_in',
          'room',
          'food_beverage',
          'telephone',
          'laundry',
          'minibar',
          'spa',
          'business_center',
          'parking',
          'internet',
          'miscellaneous',
          'package',
          'incidental',
          'tax',
          'service_charge',
          'deposit',
          'payment',
          'adjustment',
          'discount',
          'no_show_fee',
          'cancellation_fee',
          'early_departure_fee',
          'late_checkout_fee',
          'extra_bed',
          'city_tax',
          'resort_fee',
          'void',
          'refund'
        ))
    `)

    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT folio_transactions_category_check
      CHECK (category IN (
        'posting',
        'transfer_out',
        'transfer_in',
        'room',
        'food_beverage',
        'telephone',
        'laundry',
        'minibar',
        'spa',
        'business_center',
        'parking',
        'internet',
        'miscellaneous',
        'package',
        'incidental',
        'tax',
        'service_charge',
        'deposit',
        'payment',
        'adjustment',
        'discount',
        'no_show_fee',
        'cancellation_fee',
        'early_departure_fee',
        'late_checkout_fee',
        'extra_bed',
        'city_tax',
        'resort_fee',
        'void',
        'refund'
      ))
    `)
  }
}
