import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transaction_taxes'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      table
        .integer('folio_transaction_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('folio_transactions')
        .onDelete('CASCADE')
      
      table
        .integer('tax_rate_id')
        .unsigned()
        .notNullable()
        .references('tax_rate_id')
        .inTable('tax_rates')
        .onDelete('CASCADE')
      
      // Store the calculated tax amount for this specific tax on this transaction
      table.decimal('tax_amount', 10, 2).notNullable().defaultTo(0)
      
      // Store the tax rate percentage used at the time of calculation
      table.decimal('tax_rate_percentage', 5, 2).notNullable()
      
      // Store the base amount on which tax was calculated
      table.decimal('taxable_amount', 12, 2).notNullable().defaultTo(0)
      
      // Audit fields
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      
      // Unique constraint to prevent duplicate tax applications
      table.unique(['folio_transaction_id', 'tax_rate_id'])
      
      // Indexes for performance
      table.index(['folio_transaction_id'])
      table.index(['tax_rate_id'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}