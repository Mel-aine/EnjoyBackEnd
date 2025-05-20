import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('service_id').unsigned().references('id').inTable('services').onDelete('CASCADE')
      table.string('product_name', 255).notNullable()
      table.string('product_type', 255).nullable()
      table.float('price').notNullable()
      table.text('description').nullable()
      table.boolean('availability').defaultTo(true)
      table.boolean('customization_allowed').defaultTo(false)
      table.string('payment_type', 20).defaultTo('Deferred')
      table.string('status', 20).defaultTo('active')
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
