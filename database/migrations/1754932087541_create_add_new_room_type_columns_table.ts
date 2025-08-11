import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add new columns as specified
      table.string('short_code', 10).notNullable().comment('Short name for the room type')
      table.string('room_type_name', 100).notNullable().comment('The name of the room types')
      table.integer('base_adult').unsigned().notNullable().defaultTo(1).comment('Number of base adult allowed')
      table.integer('base_child').unsigned().notNullable().defaultTo(0).comment('Number of base child allowed')
      table.integer('max_adult').unsigned().notNullable().defaultTo(2).comment('Maximum number of adult allowed')
      table.integer('max_child').unsigned().notNullable().defaultTo(2).comment('Maximum number of child allowed')
      table.boolean('publish_to_website').defaultTo(true).comment('Publish this room type on website')
      table.json('room_amenities').nullable().comment('Selected room amenities')
      table.string('color', 7).defaultTo('#3498db').comment('Color for room type icon')
      table.integer('default_web_inventory').unsigned().defaultTo(0).comment('Default inventory for booking engine')
      
      // Enhanced traceability fields
      table.integer('created_by_user_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('updated_by_user_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.boolean('is_deleted').defaultTo(false).comment('Soft deletion flag')
      table.timestamp('deleted_at').nullable().comment('Soft deletion timestamp')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop new columns
      table.dropColumn('short_code')
      table.dropColumn('room_type_name')
      table.dropColumn('base_adult')
      table.dropColumn('base_child')
      table.dropColumn('max_adult')
      table.dropColumn('max_child')
      table.dropColumn('publish_to_website')
      table.dropColumn('room_amenities')
      table.dropColumn('color')
      table.dropColumn('default_web_inventory')
      table.dropColumn('created_by_user_id')
      table.dropColumn('updated_by_user_id')
      table.dropColumn('is_deleted')
      table.dropColumn('deleted_at')
    })
  }
}