import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // Add 'extract_charge' to the existing category enum
    this.schema.raw(`
      ALTER TABLE folio_transactions 
      DROP CONSTRAINT IF EXISTS folio_transactions_category_check
    `)
    
    this.schema.raw(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_category_check 
      CHECK (category IN (
        'transfer_out', 'transfer_in', 'room', 'food_beverage', 'telephone', 
        'laundry', 'minibar', 'spa', 'business_center', 'parking', 'internet', 
        'miscellaneous', 'package', 'incidental', 'tax', 'service_charge', 
        'deposit', 'payment', 'adjustment', 'no_show_fee', 'cancellation_fee', 
        'early_departure_fee', 'late_checkout_fee', 'extra_bed', 'city_tax', 
        'resort_fee', 'void', 'refund', 'extract_charge'
      ))
    `)
  }

  async down() {
    // Remove 'extract_charge' from the category enum
    this.schema.raw(`
      ALTER TABLE folio_transactions 
      DROP CONSTRAINT IF EXISTS folio_transactions_category_check
    `)
    
    this.schema.raw(`
      ALTER TABLE folio_transactions 
      ADD CONSTRAINT folio_transactions_category_check 
      CHECK (category IN (
        'transfer_out', 'transfer_in', 'room', 'food_beverage', 'telephone', 
        'laundry', 'minibar', 'spa', 'business_center', 'parking', 'internet', 
        'miscellaneous', 'package', 'incidental', 'tax', 'service_charge', 
        'deposit', 'payment', 'adjustment', 'no_show_fee', 'cancellation_fee', 
        'early_departure_fee', 'late_checkout_fee', 'extra_bed', 'city_tax', 
        'resort_fee', 'void', 'refund'
      ))
    `)
  }
}