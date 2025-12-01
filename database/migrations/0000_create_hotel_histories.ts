import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotel_histories'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('hotel_id').unsigned().notNullable().index()

      table.string('hotel_name').nullable()
      table.string('reservation_number').nullable().index()

      table.date('booking_date').nullable().index()
      table.string('booking_time', 16).nullable()

      table.string('guest_name').nullable().index()
      table.string('user_name').nullable()

      table.date('arrival_date').nullable().index()
      table.date('departure_date').nullable().index()

      table.string('room').nullable().index()
      table.string('rate_type').nullable()
      table.integer('pax').nullable()

      table.decimal('total', 12, 2).nullable()
      table.decimal('adr', 12, 2).nullable()
      table.decimal('deposit', 12, 2).nullable()
      table.string('source').nullable()
      table.decimal('total_tax', 12, 2).nullable()
      table.decimal('total_charges', 12, 2).nullable()
      table.decimal('commission', 12, 2).nullable()
      table.string('voucher').nullable()
      table.string('status').nullable().index()
      table.decimal('due_amount', 12, 2).nullable()

      table.string('email').nullable()
      table.string('mobile_no').nullable()
      table.string('city').nullable()
      table.string('country').nullable()
      table.string('zip_code').nullable()
      table.string('state').nullable()

      table.string('folio_no').nullable()
      table.text('preference').nullable()
      table.string('travel_agent').nullable()
      table.string('salesperson').nullable()
      table.text('remark').nullable()

      table.string('reservation_type').nullable()
      table.string('market_code').nullable()
      table.string('payment_type').nullable()
      table.integer('number_of_nights').nullable()

      table.date('cancellation_date').nullable().index()
      table.timestamp('last_modified_date', { useTz: true }).nullable()
      table.string('last_modified_by').nullable()
      table.integer('number_of_rooms_booked').nullable()

      table.json('extract_charge').nullable()

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

