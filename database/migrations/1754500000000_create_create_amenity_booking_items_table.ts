import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'amenity_booking_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('amenity_booking_id').unsigned().notNullable().references('id').inTable('amenity_bookings').onDelete('CASCADE')
      table.integer('amenity_product_id').unsigned().notNullable().references('id').inTable('amenity_products').onDelete('CASCADE')
      table.integer('quantity').notNullable()
      table.decimal('price_per_unit', 10, 2).notNullable()
      table.decimal('subtotal', 10, 2).notNullable()

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

