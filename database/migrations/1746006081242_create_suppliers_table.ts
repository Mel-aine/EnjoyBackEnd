import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'suppliers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('email').nullable()
      table.string('phone').nullable()
      table.string('address').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table
      .integer('service_id')
      .unsigned()
      .references('id')
      .inTable('services')
      .onDelete('SET NULL')
      .nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
