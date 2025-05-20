import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('service_id').unsigned().references('id').inTable('services').onDelete('CASCADE')
      table.string('reservation_type', 50)
      table.string('reservation_number', 50).unique().nullable()
      table.integer('guest_count').defaultTo(1).nullable()
      table.integer('number_of_seats').nullable()
      table.text('special_requests').nullable()
      table.string('payment', 50).nullable()
      table.enu('status', ['pending', 'confirmed', 'in_progress', 'completed' , 'cancelled' ,'no_show']).defaultTo('pending')
      table.text('comment').nullable()
      table.text('cancellation_reason').nullable()
      table.date('arrived_date').nullable()
      table.date('depart_date').nullable()
      table.time('reservation_time').nullable()
      // table.float('total_price')
      table.decimal('total_amount', 15, 2).notNullable()
      table.decimal('discount_amount', 15, 2).defaultTo(0.00).nullable()
      table.decimal('tax_amount', 15, 2).defaultTo(0.00).nullable()
      table.decimal('final_amount', 15, 2).notNullable().nullable()
      table.decimal('paid_amount', 15, 2).defaultTo(0.00).nullable()

      table.enu('payment_status', ['unpaid', 'partially_paid', 'paid', 'refunded', 'disputed','pending'])
        .defaultTo('unpaid')
      // table.integer('total_person')
      table.integer('reservation_product').nullable()
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
