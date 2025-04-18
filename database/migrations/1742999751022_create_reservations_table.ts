import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('service_id').unsigned().references('id').inTable('services').onDelete('CASCADE')
      table.string('reservation_type', 50)
      table.string('payment', 50).nullable()
      table.enu('status', ['pending', 'confirmed','cancelled']).defaultTo('pending')
      table.text('comment').nullable()
      table.date('arrived_date')
      table.date('depart_date')
      table.time('reservation_time').nullable()
      table.float('total_price')
      table.integer('total_person')
      table.integer('reservation_product').nullable()
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
