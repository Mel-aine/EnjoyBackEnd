import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add new fields
      table.string('phone_extension').nullable()
      table.integer('sort_key').nullable()
      table.string('key_card_alias').nullable()
      table.integer('bed_type_id').unsigned().nullable()
      table.boolean('is_deleted').defaultTo(false)
      table.dateTime('deleted_at').nullable()
      
      // Add foreign key constraint for bed_type_id
      table.foreign('bed_type_id').references('id').inTable('bed_types').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Remove new fields
      table.dropForeign(['bed_type_id'])
      table.dropColumn('phone_extension')
      table.dropColumn('sort_key')
      table.dropColumn('key_card_alias')
      table.dropColumn('bed_type_id')
      table.dropColumn('is_deleted')
      table.dropColumn('deleted_at')
    })
  }
}