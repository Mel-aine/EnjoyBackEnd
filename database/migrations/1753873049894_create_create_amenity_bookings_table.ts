import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'amenity_bookings'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('reservation_id').unsigned().notNullable().references('id').inTable('reservations').onDelete('CASCADE')
      table.string('amenity_order_number').notNullable().unique()
      table.decimal('total_amount', 10, 2).notNullable()
      table.enum('status', ['completed', 'pending', 'cancelled']).notNullable()
      table.timestamp('booked_at', { useTz: true }).defaultTo(this.now())

      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

