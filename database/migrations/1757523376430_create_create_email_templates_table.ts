import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'email_templates'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      // Required fields
      table.string('name', 255).notNullable()
      table.string('subject', 255).notNullable()
      table.text('message_body').notNullable()
      
      // Auto send enum
      table.enum('auto_send', [
        'Manual',
        'Check-in', 
        'Check-out',
        'Reservation Created',
        'Reservation Modified', 
        'Reservation Cancelled',
        'Invoice Generated',
        'Payment Received'
      ]).defaultTo('Manual')
      
      // Optional fields
      table.string('attachment', 500).nullable()
      table.date('schedule_date').nullable()
      
      // Foreign keys
      table.integer('hotel_id').unsigned().notNullable()
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      
      table.integer('template_category_id').unsigned().notNullable()
      table.foreign('template_category_id').references('id').inTable('template_categories').onDelete('CASCADE')
      
      table.integer('email_account_id').unsigned().notNullable()
      table.foreign('email_account_id').references('id').inTable('email_accounts').onDelete('CASCADE')
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.integer('deleted_by').unsigned().nullable()
      
      // Foreign key constraints for audit fields
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('deleted_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Soft delete
      table.boolean('is_deleted').defaultTo(false)
      table.timestamp('deleted_at').nullable()
      
      // Timestamps
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
      
      // Indexes for performance
      table.index(['hotel_id'], 'email_templates_hotel_id_index')
      table.index(['template_category_id'], 'email_templates_template_category_id_index')
      table.index(['email_account_id'], 'email_templates_email_account_id_index')
      table.index(['auto_send'], 'email_templates_auto_send_index')
      table.index(['is_deleted'], 'email_templates_is_deleted_index')
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}