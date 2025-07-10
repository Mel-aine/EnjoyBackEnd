import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stocks_histories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').nullable()
      table.integer('service_product_id').unsigned().references('id').inTable('service_products').onDelete('CASCADE')
      table.text('action_type').nullable()
      table.text('resource_type').nullable()
      table.integer('resource_id').nullable()
      table.text('action_description').nullable()
      table.jsonb('old_values').nullable()
      table.jsonb('new_values').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
