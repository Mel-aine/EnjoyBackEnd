import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'guests'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('guest_code', 50).unique().notNullable()
      table.enum('title', ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof']).nullable()
      table.string('first_name', 100).notNullable()
      table.string('last_name', 100).notNullable()
      table.string('middle_name', 100).nullable()
      table.string('email', 255).nullable()
      table.string('phone_primary', 20).nullable()
      table.string('phone_secondary', 20).nullable()
      table.date('date_of_birth').nullable()
      table.enum('gender', ['male', 'female', 'other']).nullable()
      table.string('nationality', 100).nullable()
      table.string('passport_number', 50).nullable()
      table.string('national_id', 50).nullable()
      table.date('passport_expiry').nullable()
      table.string('visa_number', 50).nullable()
      table.date('visa_expiry').nullable()
      table.text('address_line1').nullable()
      table.text('address_line2').nullable()
      table.string('city', 100).nullable()
      table.string('state_province', 100).nullable()
      table.string('country', 100).nullable()
      table.string('postal_code', 20).nullable()
      table.string('emergency_contact_name', 200).nullable()
      table.string('emergency_contact_phone', 20).nullable()
      table.string('emergency_contact_relationship', 50).nullable()
      table.json('special_requests').nullable()
      table.json('preferences').nullable()
      table.json('dietary_restrictions').nullable()
      table.text('notes').nullable()
      table.boolean('is_vip').defaultTo(false)
      table.string('vip_level', 20).nullable()
      table.boolean('marketing_consent').defaultTo(false)
      table.enum('guest_type', ['individual', 'corporate', 'group', 'travel_agent']).defaultTo('individual')
      table.integer('company_id').unsigned().nullable()
      table.string('company_name', 255).nullable()
      table.decimal('credit_limit', 10, 2).defaultTo(0)
      table.enum('status', ['active', 'inactive', 'blacklisted']).defaultTo('active')
      table.timestamp('last_stay_date').nullable()
      table.integer('total_stays').defaultTo(0)
      table.decimal('total_spent', 12, 2).defaultTo(0)
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Indexes
      table.index(['email'])
      table.index(['phone_primary'])
      table.index(['passport_number'])
      table.index(['national_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}