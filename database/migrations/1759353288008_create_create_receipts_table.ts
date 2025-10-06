import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'receipts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('receipt_number').notNullable().unique()
      table.integer('tenant_id').notNullable() // guestId
      table.integer('hotel_id').notNullable()
      table.timestamp('payment_date').notNullable()
      table.integer('payment_method_id').notNullable()
      table.decimal('total_amount', 10, 2).notNullable()
      table.text('description').nullable()
      table.json('breakdown').nullable() // { rent: 1600, tax: 40, discount: -100 }
      table.integer('created_by').notNullable()
      table.integer('folio_transaction_id').notNullable()
      table.boolean('is_voided').defaultTo(false)
      table.integer('voided_by').nullable()
      table.string('currency', 3).defaultTo('USD')
      table.timestamp('voided_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('tenant_id').references('id').inTable('guests').onDelete('CASCADE')
      table.foreign('payment_method_id').references('id').inTable('payment_methods').onDelete('RESTRICT')
      table.foreign('created_by').references('id').inTable('users').onDelete('RESTRICT')
      table.foreign('voided_by').references('id').inTable('users').onDelete('RESTRICT')
      table.foreign('folio_transaction_id').references('id').inTable('folio_transactions').onDelete('CASCADE')

      // Indexes
      table.index(['hotel_id', 'payment_date'])
      table.index(['created_by'])
      table.index(['folio_transaction_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}