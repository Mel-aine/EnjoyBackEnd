import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'add_ons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table
        .integer('module_id')
        .unsigned()
        .references('id')
        .inTable('modules')
        .onDelete('CASCADE')
        .notNullable()
      table.integer('min').notNullable()
      table.integer('max').notNullable()
      table.decimal('price_month', 10, 2).notNullable()
      table.decimal('price_year', 10, 2).notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
