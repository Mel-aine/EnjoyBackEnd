import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'departments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('description').nullable()
      table.string('responsible').nullable()
      table.string('status').nullable()
      table.string('number_employees').nullable()
      table
      .integer('service_id')
      .unsigned()
      .references('id')
      .inTable('services')
      .onDelete('CASCADE')
      table
      .integer('product_id')
      .unsigned()
      .references('id')
      .inTable('product_services')
      .onDelete('CASCADE')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
