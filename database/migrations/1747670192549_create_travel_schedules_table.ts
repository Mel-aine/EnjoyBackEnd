import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'travel_schedules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.integer('service_id').unsigned().notNullable().references('id').inTable('services').onDelete('CASCADE')
      table.integer('service_product_id').unsigned().nullable().references('id').inTable('service_products').onDelete('CASCADE')
      table.integer('travel_route_id').unsigned().notNullable().references('id').inTable('travel_routes').onDelete('RESTRICT')
      table.integer('travel_vehicle_id').unsigned().notNullable().references('id').inTable('travel_vehicles').onDelete('RESTRICT')
      table.integer('driver_user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')

      table.dateTime('departure_datetime').notNullable()
      table.dateTime('arrival_datetime').notNullable()
      table.integer('available_seats').notNullable()
      table.decimal('price_per_seat', 15, 2).notNullable()

      table.enu('status', ['scheduled', 'in_progress', 'completed', 'cancelled']).defaultTo('scheduled')

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