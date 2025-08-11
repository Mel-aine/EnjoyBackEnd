import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'competitor_rates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')

      table.string('competitor_name', 255).notNullable()
      table.string('room_type_description', 255).notNullable()
      table.date('rate_date').notNullable()
      table.decimal('observed_rate', 10, 2).notNullable()
      table.timestamp('crawl_datetime', { useTz: true }).notNullable()

      table
        .enu('booking_channel_observed', ['CompetitorWebsite', 'Booking.com', 'Expedia', 'Agoda', 'OtherOTA', 'Metasearch'])
        .notNullable()

      // Index utile pour accélérer les recherches par hotel et date
      table.index(['hotel_id', 'rate_date'], 'idx_hotel_rate_date')

      table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('last_modified_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
