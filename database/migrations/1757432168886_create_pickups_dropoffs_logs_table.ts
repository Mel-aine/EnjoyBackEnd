import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pickups_dropoffs_logs'


  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('guest_id').unsigned().references('id').inTable('guests')
      table.integer('reservation_id').unsigned().references('id').inTable('reservations').nullable()
      table.integer('transportation_mode_id').unsigned().references('id').inTable('transportation_modes')
      table.timestamp('request_date').notNullable()
      table.timestamp('scheduled_date_time').notNullable()
      table.timestamp('actual_date_time').nullable()
      table.enum('service_type', ['Pickup', 'Dropoff']).notNullable()
      table.enum('location_type', ['Airport', 'Train Station', 'Hotel', 'Local Address']).notNullable()
      table.string('pickup_point').notNullable()
      table.string('dropoff_point').notNullable()
      table.string('flight_train_number').nullable()
      table.string('airline_train_company').nullable()
      table.integer('number_of_passengers').notNullable()
      table.integer('number_of_luggage').notNullable()
      table.text('special_requirements').nullable()
      table.enum('status', ['Pending', 'Assigned', 'En Route', 'Completed', 'Cancelled']).defaultTo('Pending')
      table.string('cancellation_reason').nullable()
      table.text('requested_by').nullable()
      table.string('external_booking_reference').nullable()
      table.string('external_vehicle_matriculation').nullable()
      table.string('external_driver_name').nullable()
      table.string('external_vehicle_color').nullable()
      table.decimal('service_fee', 10, 2).nullable()
      table.boolean('charge_posted_to_folio').defaultTo(false)
      table.integer('folio_id').unsigned().references('id').inTable('folios').nullable()
      table.integer('created_by').unsigned().references('id').inTable('users')
      table.integer('last_modified_by').unsigned().references('id').inTable('users').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }


  async down() {
    this.schema.dropTable(this.tableName)
  }
}
