import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Core folio fields
      table.integer('company_id').unsigned().nullable().after('guest_id')
      table.integer('group_id').unsigned().nullable().after('company_id')
      
      // Status fields
      table.enum('settlement_status', ['pending', 'partial', 'settled', 'overdue', 'disputed']).defaultTo('pending').after('status')
      table.enum('workflow_status', ['draft', 'active', 'review', 'approved', 'finalized']).defaultTo('active').after('settlement_status')
      
      // Date and user tracking
      table.timestamp('opened_date').nullable().after('workflow_status')
      table.integer('opened_by').unsigned().nullable().after('opened_date')
      
      // Financial breakdown fields
      table.decimal('total_taxes', 12, 2).defaultTo(0).after('total_adjustments')
      table.decimal('total_service_charges', 12, 2).defaultTo(0).after('total_taxes')
      table.decimal('total_discounts', 12, 2).defaultTo(0).after('total_service_charges')
      
      // Currency fields
      table.string('currency_code', 3).defaultTo('USD').after('credit_limit')
      table.decimal('exchange_rate', 10, 6).defaultTo(1.0).after('currency_code')
      
      // Charge breakdown fields
      table.decimal('room_charges', 12, 2).defaultTo(0).after('exchange_rate')
      table.decimal('food_beverage_charges', 12, 2).defaultTo(0).after('room_charges')
      
      // Additional notes fields
      table.text('internal_notes').nullable().after('special_instructions')
      table.text('guest_notes').nullable().after('internal_notes')
      
      // Tax and billing preferences
      table.string('gstin_no').nullable().after('guest_notes')
      table.boolean('show_tariff_on_print').defaultTo(true).after('gstin_no')
      table.boolean('post_commission_to_ta').defaultTo(false).after('show_tariff_on_print')
      table.boolean('generate_invoice_number').defaultTo(true).after('post_commission_to_ta')
      
      // Note: Foreign key constraints can be added later when referenced tables exist
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // No foreign keys to drop
      
      // Drop columns in reverse order
      table.dropColumn('generate_invoice_number')
      table.dropColumn('post_commission_to_ta')
      table.dropColumn('show_tariff_on_print')
      table.dropColumn('gstin_no')
      table.dropColumn('guest_notes')
      table.dropColumn('internal_notes')
      table.dropColumn('food_beverage_charges')
      table.dropColumn('room_charges')
      table.dropColumn('exchange_rate')
      table.dropColumn('currency_code')
      table.dropColumn('total_discounts')
      table.dropColumn('total_service_charges')
      table.dropColumn('total_taxes')
      table.dropColumn('opened_by')
      table.dropColumn('opened_date')
      table.dropColumn('workflow_status')
      table.dropColumn('settlement_status')
      table.dropColumn('group_id')
      table.dropColumn('company_id')
    })
  }
}