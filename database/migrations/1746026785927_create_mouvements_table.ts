import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'mouvements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('type').notNullable()
      table.integer('quantity').unsigned().notNullable()
      table.string('source').notNullable()
      table.string('destination').notNullable()
      table.string('user').notNullable()
      table.text('notes').nullable()
      table.date('date').nullable()

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
