import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_methods'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('method_name', 100).notNullable()
      table.string('method_code', 20).unique().notNullable()
      table.enum('method_type', [
        'cash', 'credit_card', 'debit_card', 'bank_transfer', 
        'check', 'digital_wallet', 'cryptocurrency', 'gift_card',
        'corporate_account', 'comp', 'house_account', 'voucher'
      ]).notNullable()
      table.text('description').nullable()
      table.boolean('is_active').defaultTo(true)
      table.boolean('requires_authorization').defaultTo(false)
      table.boolean('requires_signature').defaultTo(false)
      table.boolean('requires_id_verification').defaultTo(false)
      table.decimal('processing_fee_percentage', 5, 4).defaultTo(0)
      table.decimal('processing_fee_fixed', 10, 2).defaultTo(0)
      table.decimal('minimum_amount', 10, 2).defaultTo(0)
      table.decimal('maximum_amount', 12, 2).nullable()
      table.integer('settlement_days').defaultTo(0)
      table.string('processor_name', 100).nullable()
      table.string('merchant_id', 100).nullable()
      table.json('processor_config').nullable()
      table.boolean('supports_refunds').defaultTo(true)
      table.boolean('supports_partial_refunds').defaultTo(true)
      table.boolean('supports_preauth').defaultTo(false)
      table.boolean('auto_settle').defaultTo(true)
      table.string('currency_code', 3).defaultTo('USD')
      table.json('accepted_currencies').nullable()
      table.text('terms_and_conditions').nullable()
      table.integer('sort_order').defaultTo(0)
      table.string('icon_url', 500).nullable()
      table.json('validation_rules').nullable()
      table.boolean('is_default').defaultTo(false)
      table.enum('status', ['active', 'inactive', 'maintenance']).defaultTo('active')
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}