import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'booking_sources'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('source_name', 100).notNullable()
      table.string('source_code', 20).unique().notNullable()
      table.enum('source_type', ['direct', 'ota', 'gds', 'travel_agent', 'corporate', 'phone', 'walk_in', 'email', 'website']).notNullable()
      table.text('description').nullable()
      table.decimal('commission_rate', 5, 4).defaultTo(0)
      table.enum('commission_type', ['percentage', 'fixed']).defaultTo('percentage')
      table.decimal('fixed_commission', 10, 2).defaultTo(0)
      table.string('contact_person', 200).nullable()
      table.string('contact_email', 255).nullable()
      table.string('contact_phone', 20).nullable()
      table.text('contact_address').nullable()
      table.string('api_endpoint', 500).nullable()
      table.string('api_key', 255).nullable()
      table.json('api_credentials').nullable()
      table.boolean('is_active').defaultTo(true)
      table.boolean('auto_confirm').defaultTo(false)
      table.integer('default_payment_terms').defaultTo(0) // days
      table.json('booking_rules').nullable()
      table.json('rate_restrictions').nullable()
      table.text('special_instructions').nullable()
      table.integer('priority_level').defaultTo(5)
      table.decimal('markup_percentage', 5, 4).defaultTo(0)
      table.boolean('requires_guarantee').defaultTo(false)
      table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active')
      
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
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}