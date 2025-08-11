import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'supplier_invoices'

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
        .unique()

      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('CASCADE')
        .unique()

      table.string('invoice_number', 100).notNullable().unique()

      table.date('invoice_date').notNullable()
      table.date('due_date').notNullable()

      table.decimal('total_amount', 10, 2).notNullable()
      table.decimal('amount_paid', 10, 2).notNullable().defaultTo(0.0)

      table
        .enu('payment_status', [
          'Pending',
          'Partial',
          'Paid',
          'Overdue',
          'Disputed',
          'Voided',
        ])
        .notNullable()

      table.text('description').nullable()

      table
        .integer('purchase_order_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('purchase_orders')
        .onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
