import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('min_price', 10, 2).nullable()
      table.decimal('max_price', 10, 2).nullable()
      table.integer('state_length').nullable()
      table.string('cut_off_time').nullable()
      table.integer('cut_off_days').nullable()
      table.integer('max_day_advance').nullable()
      table.decimal('longitude', 10, 8).nullable()
      table.decimal('latitude', 10, 8).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('min_price')
      table.dropColumn('max_price')
      table.dropColumn('state_length')
      table.dropColumn('cut_off_time')
      table.dropColumn('cut_off_days')
      table.dropColumn('max_day_advance')
      table.dropColumn('longitude')
      table.dropColumn('latitude')
    })
  }
}