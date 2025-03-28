import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('reservation_id').unsigned().nullable().references('id').inTable('reservations').onDelete('SET NULL')
      table.integer('order_id').unsigned().nullable().references('id').inTable('orders').onDelete('SET NULL')
      table.float('amount_paid').notNullable()
      table.string('payment_method', 50).notNullable()
      table.enu('status', ['succeeded', 'pending','failed']).defaultTo('pending')
      table.string('transaction_id', 255).notNullable()
      // table.timestamp('date').notNullable()
      table.dateTime('date',{ useTz: true }).defaultTo(this.now())
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
