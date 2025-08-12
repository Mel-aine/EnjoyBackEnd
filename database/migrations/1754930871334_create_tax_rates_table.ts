import { BaseSchema } from '@adonisjs/lucid/schema'

export default class  extends BaseSchema {
  protected tableName = 'tax_rates'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tax_rate_id').primary()

      table
        .integer('hotel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')

      table.string('tax_name', 100).notNullable()
      table.decimal('rate_percentage', 5, 2).notNullable()

      table.boolean('is_active').notNullable().defaultTo(true)
      table.boolean('applies_to_room_rate').notNullable().defaultTo(true)
      table.boolean('applies_to_fnb').notNullable().defaultTo(false)
      table.boolean('applies_to_other_services').notNullable().defaultTo(false)

      table.date('effective_date').nullable()
      table.date('end_date').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
