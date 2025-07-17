import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'refunds'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.decimal('refund_amount', 10, 2).notNullable()
      table.timestamp('refund_date').notNullable()
      table.string('refund_method', 50).notNullable()
      table.string('transaction_reference', 255).nullable()
      table.text('reason').notNullable()
      table.string('status', 20).notNullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
      table.integer('reservation_id').unsigned().references('id').inTable('reservations').onDelete('CASCADE')
      table.integer('payment_id_original').unsigned().references('id').inTable('payments').onDelete('SET NULL').nullable()
      table.integer('processed_by_user_id').unsigned().references('id').inTable('users').onDelete('RESTRICT')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
