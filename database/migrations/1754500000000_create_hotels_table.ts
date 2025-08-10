import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('hotel_name', 255).notNullable()
      table.string('hotel_code', 50).unique().notNullable()
      table.text('address').nullable()
      table.string('city', 100).nullable()
      table.string('state_province', 100).nullable()
      table.string('country', 100).nullable()
      table.string('postal_code', 20).nullable()
      table.string('phone_number', 20).nullable()
      table.string('email', 255).nullable()
      table.string('website', 255).nullable()
      table.integer('total_rooms').defaultTo(0)
      table.integer('total_floors').defaultTo(0)
      table.string('currency_code', 3).defaultTo('USD')
      table.string('timezone', 50).defaultTo('UTC')
      table.decimal('tax_rate', 5, 4).defaultTo(0)
      table.string('license_number', 100).nullable()
      table.enum('status', ['active', 'inactive', 'maintenance']).defaultTo('active')
      table.json('amenities').nullable()
      table.json('policies').nullable()
      table.text('description').nullable()
      table.string('logo_url', 500).nullable()
      table.json('contact_info').nullable()
      table.json('social_media').nullable()
      
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