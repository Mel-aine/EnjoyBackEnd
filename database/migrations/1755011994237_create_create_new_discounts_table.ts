import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'discounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      // Main fields
      table.integer('hotel_id').unsigned().notNullable()
      table.string('short_code', 50).notNullable()
      table.string('name', 255).notNullable()
      table.enum('type', ['percentage', 'flat']).notNullable()
      table.boolean('open_discount').defaultTo(false)
      table.decimal('value', 10, 2).notNullable()
      table.enum('apply_on', ['room_charge', 'extra_charge']).notNullable()
      
      // Audit fields
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.integer('created_by_user_id').unsigned().nullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.integer('updated_by_user_id').unsigned().nullable()
      table.boolean('is_deleted').defaultTo(false)
      table.timestamp('deleted_at', { useTz: true }).nullable()
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('created_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('updated_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      
      // Unique constraint
      table.unique(['hotel_id', 'short_code'])
      
      // Indexes
      table.index(['hotel_id'])
      table.index(['type'])
      table.index(['apply_on'])
      table.index(['is_deleted'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}