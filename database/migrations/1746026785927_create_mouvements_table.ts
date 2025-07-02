import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'mouvements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('type').notNullable()
      table.integer('quantity').unsigned().notNullable()
      table.string('source').notNullable()
      table.string('user').notNullable()
      table.text('notes').nullable()
      table.date('date').nullable()
      table
        .integer('department_id')
        .unsigned()
        .references('id')
        .inTable('departments')
        .onDelete('CASCADE').nullable()

          table
        .integer('stock_category_id')
        .unsigned()
        .references('id')
        .inTable('stock_categories')
        .onDelete('CASCADE')

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
        .inTable('products')
        .onDelete('CASCADE')
        table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
        table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
