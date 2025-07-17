import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'cancellation_policies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('policy_id').primary()
      table
        .integer('hotel_id')
        .unsigned()
        .notNullable()
        .references('hotel_id')
        .inTable('hotels')
        .onDelete('CASCADE')
      table.string('policy_name', 255).notNullable()
      table.integer('free_cancellation_period_value').notNullable()
      table.enum('free_cancellation_period_unit', ['hours', 'days']).notNullable()
      table
        .enum('cancellation_fee_type', ['none', 'fixed', 'percentage', 'first_night'])
        .notNullable()
      table.decimal('cancellation_fee_value', 10, 2).nullable()
      table.boolean('non_refundable_rate_enabled').notNullable().defaultTo(false)
      table.text('special_conditions_notes').nullable()
      table
        .integer('last_modified_by_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')

      table.timestamp('last_modified_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
