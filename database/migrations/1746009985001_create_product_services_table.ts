import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_services'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('code').notNullable()
      table.string('name').notNullable()
      table.integer('quantity').notNullable().defaultTo(0)
      table.decimal('price', 10, 2).notNullable().defaultTo(0.00)

      table
        .integer('service_id')
        .unsigned()
        .references('id')
        .inTable('services')
        .onDelete('SET NULL')
        .nullable()

      table
        .integer('supplier_id')
        .unsigned()
        .references('id')
        .inTable('suppliers')
        .onDelete('SET NULL')
        .nullable()

      table
        .integer('stock_category_id')
        .unsigned()
        .references('id')
        .inTable('stock_categories')
        .onDelete('SET NULL')
        .nullable()

      table.text('status').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
