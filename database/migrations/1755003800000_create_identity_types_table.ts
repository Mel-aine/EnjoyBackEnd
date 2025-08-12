import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'identity_types'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE')
      table.string('name', 100).notNullable()
      table.string('short_code', 10).notNullable()
      
      // Audit fields
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      table.integer('created_by_user_id').unsigned().references('id').inTable('users').nullable()
      table.integer('updated_by_user_id').unsigned().references('id').inTable('users').nullable()
      table.boolean('is_deleted').notNullable().defaultTo(false)
      table.timestamp('deleted_at', { useTz: true }).nullable()
      
      // Indexes
      table.index(['hotel_id', 'is_deleted'])
      table.unique(['hotel_id', 'short_code'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}