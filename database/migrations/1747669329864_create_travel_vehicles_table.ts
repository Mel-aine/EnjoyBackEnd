import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'travel_vehicles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('service_id').unsigned().notNullable().references('id').inTable('services').onDelete('CASCADE')
      table.integer('service_product_id').unsigned().references('id').inTable('service_products').onDelete('CASCADE').nullable()
      table.string('vehicle_type').nullable()
      table.string('brand', 100).nullable()
      table.string('model', 100).nullable()
      table.integer('year').nullable()
      table.string('registration_number', 50).notNullable().unique()
      table.integer('capacity').notNullable()
      table.json('features').nullable()
      table.date('last_maintenance_date').nullable()
      table.date('next_maintenance_date').nullable()
      table.enu('status', ['available', 'in_use', 'maintenance', 'out_of_order']).defaultTo('available')
      table.text('notes').nullable()
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
