import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'company_accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable()
      table.string('company_name', 255).notNullable()
      table.string('company_code', 50).nullable()
      table.enum('account_type', ['Corporate', 'TravelAgency', 'Government', 'Airline', 'Other']).notNullable()
      table.string('contact_person_name', 255).nullable()
      table.string('contact_person_title', 100).nullable()
      table.string('primary_email', 255).nullable()
      table.string('secondary_email', 255).nullable()
      table.string('primary_phone', 20).nullable()
      table.string('secondary_phone', 20).nullable()
      table.string('fax_number', 20).nullable()
      table.string('website', 255).nullable()
      table.string('billing_address_line1', 255).nullable()
      table.string('billing_address_line2', 255).nullable()
      table.string('billing_city', 100).nullable()
      table.string('billing_state_province', 100).nullable()
      table.string('billing_postal_code', 20).nullable()
      table.string('billing_country', 100).nullable()
      table.string('tax_id', 50).nullable()
      table.decimal('credit_limit', 10, 2).nullable()
      table.decimal('current_balance', 10, 2).notNullable().defaultTo(0)
      table.string('payment_terms', 100).nullable()
      table.decimal('discount_percentage', 5, 2).nullable()
      table.decimal('commission_percentage', 5, 2).nullable()
      table.enum('account_status', ['Active', 'Inactive', 'Suspended', 'Closed']).notNullable().defaultTo('Active')
      table.enum('credit_status', ['Good', 'Warning', 'Hold', 'Blocked']).notNullable().defaultTo('Good')
      table.timestamp('last_activity_date').nullable()
      table.string('preferred_currency', 3).nullable()
      table.enum('billing_cycle', ['Weekly', 'BiWeekly', 'Monthly', 'Quarterly', 'Custom']).nullable()
      table.boolean('auto_billing_enabled').defaultTo(false)
      table.text('special_instructions').nullable()
      table.text('notes').nullable()
      table.boolean('add_to_business_source').defaultTo(false)
      table.boolean('do_not_count_as_city_ledger').defaultTo(false)
      
      // Audit fields
      table.integer('created_by').unsigned().notNullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('created_by').references('id').inTable('users').onDelete('RESTRICT')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['hotel_id'])
      table.index(['account_status'])
      table.index(['credit_status'])
      table.index(['account_type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}