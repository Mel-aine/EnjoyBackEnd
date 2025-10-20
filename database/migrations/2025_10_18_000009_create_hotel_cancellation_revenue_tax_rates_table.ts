import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotel_cancellation_revenue_tax_rates'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)

    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id')
        table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE')
        table.integer('tax_rate_id').unsigned().references('tax_rate_id').inTable('tax_rates').onDelete('CASCADE')
        table.timestamp('created_at')
        table.timestamp('updated_at')
        table.unique(['hotel_id', 'tax_rate_id'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}