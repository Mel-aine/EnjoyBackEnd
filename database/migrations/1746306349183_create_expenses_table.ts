import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'expenses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('supplier_name').notNullable()
      table.string('invoice_number').notNullable()
      table.string('category').notNullable()
      table.string('department').notNullable()
      table.date('date').notNullable()
      table.date('due_date').nullable()
      table.text('description').nullable()
      table.decimal('amount_before_tax', 12, 2).notNullable()
      table.decimal('tax_rate', 5, 2).notNullable().defaultTo(18.0)
      table.enum('status', ['paid', 'unpaid', 'pending', 'overdue']).defaultTo('pending')
      table.string('payment_method').nullable()
      table
        .integer('service_id')
        .unsigned()
        .references('id')
        .inTable('services')
        .onDelete('CASCADE')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}