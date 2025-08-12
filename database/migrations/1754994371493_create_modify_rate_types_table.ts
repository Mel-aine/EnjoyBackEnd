import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rate_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop columns
      table.dropColumn('nights')
      table.dropColumn('max_adult')
      table.dropColumn('min_night')
      table.dropColumn('room_type_id')
      
      // Add new columns
      table.boolean('is_package').nullable()
      table.json('room_types').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop new columns
      table.dropColumn('is_package')
      table.dropColumn('room_types')
      
      // Restore old columns
      table.integer('nights')
      table.integer('max_adult')
      table.integer('min_night')
      table.integer('room_type_id').nullable()
    })
  }
}