import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('hotel_id')
        .unsigned()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')
      table.integer('module_id').unsigned().references('id').inTable('modules')

      table.timestamp('starts_at').notNullable() // Date d'achat / début
      table.timestamp('ends_at').nullable() // Date d'expiration
      table.enum('status', ['active', 'past_due', 'canceled']).defaultTo('active')
      table.decimal('price', 10, 2).notNullable()
      table.enum('billing_cycle', ['monthly', 'yearly']).defaultTo('monthly')
      table.enum('payment_status', ['paid', 'pending', 'failed']).defaultTo('pending')

      // Pour gérer les limites (ex: nombre de chambres ou de terminaux POS)
      table.integer('limit_count').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}