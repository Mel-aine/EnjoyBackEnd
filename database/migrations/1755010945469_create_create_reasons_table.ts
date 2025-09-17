import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reasons'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('category').notNullable()
      table.string('reason_name').notNullable()
      table.integer('hotel_id').unsigned().notNullable()
      
      // Audit fields
      table.timestamp('created_at').notNullable()
      table.integer('created_by_user_id').unsigned().notNullable()
      table.timestamp('updated_at').notNullable()
      table.integer('updated_by_user_id').unsigned().notNullable()
      table.boolean('is_deleted').defaultTo(false)
      table.timestamp('deleted_at').nullable()
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('created_by_user_id').references('id').inTable('users').onDelete('RESTRICT')
      table.foreign('updated_by_user_id').references('id').inTable('users').onDelete('RESTRICT')
      
      // Indexes
      table.index(['hotel_id'])
      table.index(['category'])
      table.index(['is_deleted'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}