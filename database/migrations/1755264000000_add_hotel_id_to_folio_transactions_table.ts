import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add hotel_id column - make it nullable first, then update, then make not null
      table.integer('hotel_id').unsigned().nullable().after('id')
      
      // Add foreign key constraint
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      
      // Add index for better query performance
      table.index(['hotel_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop foreign key constraint first
      table.dropForeign(['hotel_id'])
      
      // Drop the column
      table.dropColumn('hotel_id')
    })
  }
}