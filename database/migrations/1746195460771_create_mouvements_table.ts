import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'mouvements'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
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
        .integer('hotel_id')
        .unsigned()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')
      table
        .integer('product_id')
        .unsigned()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
        table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
        table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
