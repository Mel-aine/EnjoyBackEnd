import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'purchase_orders'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('hotel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')

      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('CASCADE')

      table.timestamp('order_datetime', { useTz: true }).notNullable()
      table.date('estimated_delivery_date').nullable()
      table.date('actual_delivery_date').nullable()

      table
        .enu('order_status', [
          'Pending',
          'Ordered',
          'PartiallyReceived',
          'Received',
          'Cancelled',
          'Closed',
          'Disputed',
        ])
        .notNullable()

      table.decimal('total_order_amount', 12, 2).notNullable()

      table
        .integer('ordering_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.text('notes').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
