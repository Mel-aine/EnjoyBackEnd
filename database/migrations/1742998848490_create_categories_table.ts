import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('category_name', 255).notNullable()
      table.integer('parent_category_id')
      table.text('description', 'longtext')
      table.text('icon', 'longtext')
      table.enu('status', ['active', 'inactive', 'archived']).defaultTo('active')
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
