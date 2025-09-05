import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('check_in_time').nullable()
      table.string('check_out_time').nullable()
      table.string('internet_access_type').nullable()
      table.decimal('internet_access_cost', 10, 2).nullable()
      table.string('internet_access_coverage').nullable()
      table.string('parking_type').nullable()
      table.boolean('parking_reservation').nullable()
      table.boolean('parking_is_private').nullable()
      table.string('pets_policy').nullable()
      table.decimal('pets_non_refundable_fee', 10, 2).nullable()
      table.decimal('pets_refundable_deposit', 10, 2).nullable()
      table.text('smoking_policy').nullable()
      table.boolean('is_adults_only').nullable()
      table.integer('max_count_of_guests').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('check_in_time')
      table.dropColumn('check_out_time')
      table.dropColumn('internet_access_type')
      table.dropColumn('internet_access_cost')
      table.dropColumn('internet_access_coverage')
      table.dropColumn('parking_type')
      table.dropColumn('parking_reservation')
      table.dropColumn('parking_is_private')
      table.dropColumn('pets_policy')
      table.dropColumn('pets_non_refundable_fee')
      table.dropColumn('pets_refundable_deposit')
      table.dropColumn('smoking_policy')
      table.dropColumn('is_adults_only')
      table.dropColumn('max_count_of_guests')
    })
  }
}