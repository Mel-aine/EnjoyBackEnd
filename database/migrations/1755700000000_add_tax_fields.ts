import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'add_tax_fields'

  async up() {
    // Add tax_exempt column to reservations table
    this.schema.alterTable('reservations', (table) => {
      table.boolean('tax_exempt').defaultTo(false).notNullable()
      table.string('tax_exempt_reason', 255).nullable()
    })

    // Add net_amount and taxAmount columns to reservation_rooms table
    this.schema.alterTable('reservation_rooms', (table) => {
      table.decimal('net_amount', 10, 2).nullable()
      table.decimal('tax_amount', 10, 2).nullable()
    })
  }

  async down() {
    // Remove columns from reservation_rooms table
    this.schema.alterTable('reservation_rooms', (table) => {
      table.dropColumn('net_amount')
      table.dropColumn('tax_amount')
    })

    // Remove columns from reservations table
    this.schema.alterTable('reservations', (table) => {
      table.dropColumn('tax_exempt_reason')
      table.dropColumn('tax_exempt')
    })
  }
}