import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_suppliers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('service_id').unsigned().notNullable()
      table.integer('supplier_user_id').unsigned().notNullable()
      table.boolean('is_preferred').defaultTo(false)
      table.integer('created_by').nullable()
      table.foreign('service_id').references('id').inTable('services').onDelete('CASCADE')
      table.foreign('supplier_user_id').references('id').inTable('users').onDelete('CASCADE')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')

      

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}