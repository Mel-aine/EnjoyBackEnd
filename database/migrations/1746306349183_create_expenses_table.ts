import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'expenses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('service_id')
        .unsigned()
        .references('id')
        .inTable('services')
        .onDelete('RESTRICT')

      table
        .integer('department_id')
        .unsigned()
        .references('id')
        .inTable('departments')
        .onDelete('SET NULL')
        .nullable()

      table
        .integer('supplier_id')
        // .unsigned()
        // .references('id')
        // .inTable('suppliers')
        // .onDelete('SET NULL')
        .nullable()

      table
        .integer('expense_category_id')
      //   .unsigned()
      //   .references('id')
      //   .inTable('expense_categories')
      //   .onDelete('RESTRICT')

      table.string('invoice_number', 100).nullable()
      table.text('description').notNullable()
      table.decimal('amount_before_tax', 15, 2).notNullable()
      table.decimal('tax_rate', 5, 2).defaultTo(0.0)

      table.decimal('tax_amount', 15, 2).nullable() // Calculé côté backend
      table.decimal('total_amount', 15, 2).nullable() // Calculé côté backend

      table.date('expense_date').notNullable()
      table.date('due_date').nullable()
      table.date('payment_date').nullable()

      table
        .string('payment_method')
        .defaultTo('cash')

      table.string('payment_reference', 255).nullable()
      table.string('receipt_image', 255).nullable()

      table
        .enu('status', ['pending', 'paid', 'cancelled', 'disputed'])
        .defaultTo('pending')

      table.text('notes').nullable()

      table
        .integer('created_by')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()

      table
        .integer('last_modified_by')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())



      // table.string('supplier_name').notNullable()
      // table.string('invoice_number').notNullable()
      // table.string('category').notNullable()
      // table.string('department').notNullable()
      // table.date('date').notNullable()
      // table.date('due_date').nullable()
      // table.text('description').nullable()
      // table.decimal('amount_before_tax', 12, 2).notNullable()
      // table.decimal('tax_rate', 5, 2).notNullable().defaultTo(18.0)
      // table.enum('status', ['paid', 'unpaid', 'pending', 'overdue']).defaultTo('pending')
      // table.string('payment_method').nullable()
      // table
      //   .integer('service_id')
      //   .unsigned()
      //   .references('id')
      //   .inTable('services')
      //   .onDelete('CASCADE')
      // table.timestamp('created_at')
      // table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}