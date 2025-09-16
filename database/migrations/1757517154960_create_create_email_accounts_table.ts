import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'email_accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE')
      table.string('title').notNullable()
      table.string('email_address').notNullable()
      table.string('display_name').notNullable()
      table.text('signature').nullable()
      table.boolean('is_active').defaultTo(true)
      table.integer('created_by').nullable()
      table.integer('last_modified_by').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}