import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.text('description').nullable()
      table.integer('default_guest').nullable()
      table.float('price').nullable()
      table.float('extra_guest_price').nullable()
      table.float('default_deposit').nullable()
      table.enu('status', ['active', 'inactive']).defaultTo('active')
      table
      .integer('service_id')
      .unsigned()
      .references('id')
      .inTable('services')
      .onDelete('SET NULL')
      .nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
