import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_tax_rates'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('room_id').unsigned().references('id').inTable('rooms').onDelete('CASCADE')
      table.integer('tax_rate_id').unsigned().references('tax_rate_id').inTable('tax_rates').onDelete('CASCADE')
      table.timestamp('created_at')
      table.timestamp('updated_at')
      
      // Ensure unique combination of room and tax rate
      table.unique(['room_id', 'tax_rate_id'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}