import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop old columns that will be replaced
      table.dropColumn('type_name')
      table.dropColumn('type_code')
      table.dropColumn('description')
      table.dropColumn('max_occupancy')
      table.dropColumn('base_rate')
      table.dropColumn('size_sqm')
      table.dropColumn('bed_count')
      table.dropColumn('bed_type')
      table.dropColumn('amenities')
      table.dropColumn('features')
      table.dropColumn('view_type')
      table.dropColumn('smoking_allowed')
      table.dropColumn('pet_friendly')
      table.dropColumn('status')
      table.dropColumn('images')
      table.dropColumn('cancellation_policy')
      table.dropColumn('sort_order')
      table.dropColumn('created_by')
      table.dropColumn('last_modified_by')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Restore dropped columns
      table.string('type_name')
      table.string('type_code')
      table.text('description')
      table.integer('max_occupancy')
      table.decimal('base_rate', 10, 2)
      table.decimal('size_sqm', 8, 2)
      table.integer('bed_count')
      table.string('bed_type')
      table.json('amenities')
      table.json('features')
      table.string('view_type')
      table.boolean('smoking_allowed')
      table.boolean('pet_friendly')
      table.string('status')
      table.json('images')
      table.text('cancellation_policy')
      table.integer('sort_order')
      table.integer('created_by')
      table.integer('last_modified_by')
    })
  }
}