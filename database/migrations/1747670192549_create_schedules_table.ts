import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'schedules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.integer('service_id').unsigned().notNullable().references('id').inTable('services').onDelete('CASCADE')
      table.integer('service_product_id').unsigned().nullable().references('id').inTable('service_products').onDelete('CASCADE')
      table.integer('travel_route_id').unsigned().nullable().references('id').inTable('travel_routes').onDelete('RESTRICT').nullable()
      table.integer('travel_vehicle_id').unsigned().nullable().references('id').inTable('travel_vehicles').onDelete('RESTRICT').nullable()
      table.integer('driver_user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').nullable()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').nullable()
      table.dateTime('departure_datetime').nullable()
      table.dateTime('arrival_datetime').nullable()
      table.integer('available_seats').nullable()
      table.decimal('price_per_seat', 15, 2).nullable()
      table.date('schedule_date').nullable()
      table.time('start_time').nullable()
      table.time('end_time').nullable()
      table.text('status')

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
