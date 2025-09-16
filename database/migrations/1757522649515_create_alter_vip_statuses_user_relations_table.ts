import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vip_statuses'

  async up() {
    // First, drop existing columns
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('created_by')
      table.dropColumn('last_modified_by')
    })
    
    // Then, add new integer columns with foreign key constraints
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      
      // Add foreign key constraints
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop foreign key constraints and integer columns
      table.dropForeign(['created_by'])
      table.dropForeign(['last_modified_by'])
      table.dropColumn('created_by')
      table.dropColumn('last_modified_by')
      
      // Restore original string columns
      table.string('created_by', 100).notNullable()
      table.string('last_modified_by', 100).notNullable()
    })
  }
}