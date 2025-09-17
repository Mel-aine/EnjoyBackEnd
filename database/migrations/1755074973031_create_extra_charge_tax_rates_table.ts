import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'extra_charge_tax_rates'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('extra_charge_id').unsigned().references('id').inTable('extra_charges').onDelete('CASCADE')
      table.integer('tax_rate_id').unsigned().references('tax_rate_id').inTable('tax_rates').onDelete('CASCADE')
      
      table.timestamp('created_at')
      table.timestamp('updated_at')
      
      // Unique constraint to prevent duplicate relationships
      table.unique(['extra_charge_id', 'tax_rate_id'])
      
      // Indexes
      table.index(['extra_charge_id'])
      table.index(['tax_rate_id'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}