import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'options'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.string('option_name', 255).notNullable()
      table.text('description').nullable()
      table.json('values').nullable()
      table.json('values').nullable()
      table.string('linked_entity_type').nullable()
      table.string('linked_entity_id').nullable()
      table.integer('category_id').unsigned().references('id').inTable('categories').onDelete('SET NULL').nullable()
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table
        .integer('product_type_id')
        .unsigned()
        .references('id')
        .inTable('product_types')
        .onDelete('SET NULL')
        .nullable()


      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
