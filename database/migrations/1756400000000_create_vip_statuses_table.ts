import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vip_statuses'

  public async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      // Required fields
      table.string('name', 100).notNullable()
      table.string('color', 7).notNullable() // For hex color codes (#RRGGBB)
      table.string('icon', 100).notNullable()
      
      // Foreign key to hotels table
      table.integer('hotel_id').unsigned().notNullable()
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      
      // Audit fields
      table.string('created_by', 100).notNullable()
      table.string('last_modified_by', 100).notNullable()
      
      // Timestamps
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
      
      // Indexes for performance
      table.index(['hotel_id'], 'vip_statuses_hotel_id_index')
      table.index(['name'], 'vip_statuses_name_index')
      table.index(['hotel_id', 'name'], 'vip_statuses_hotel_id_name_index')
      
      // Unique constraint to prevent duplicate names within the same hotel
      table.unique(['hotel_id', 'name'], 'vip_statuses_hotel_id_name_unique')
    })
    }
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}