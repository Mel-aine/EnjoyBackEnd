import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'travel_routes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('service_id').unsigned().notNullable().references('id').inTable('services').onDelete('CASCADE')

      table.string('route_name', 255).notNullable()
      table.string('origin', 255).nullable()
      table.string('destination', 255).nullable()

      table.decimal('distance', 10, 2).nullable()
      table.integer('estimated_duration').nullable() 
      table.json('stops').nullable()
      table.string('route_map', 255).nullable()

      table.enu('status', ['active', 'inactive', 'seasonal']).defaultTo('active')

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