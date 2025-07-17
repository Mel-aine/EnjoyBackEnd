import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_service_products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('reservation_id').unsigned().references('id').inTable('reservations').onDelete('CASCADE')
      table.integer('service_product_id').unsigned().references('id').inTable('service_products').onDelete('CASCADE')
      table.timestamp('check_in_date', { useTz: true }).nullable()
      table.timestamp('check_out_date', { useTz: true }).nullable()
      table.string('status').nullable()
      table.dateTime('start_date',{ useTz: true }).defaultTo(this.now())
      table.dateTime('end_date',{ useTz: true }).defaultTo(this.now())
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
