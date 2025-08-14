import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'business_sources'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('market_code_id').unsigned().nullable().after('name')
      
      // Foreign key constraint
      table.foreign('market_code_id').references('id').inTable('market_codes').onDelete('SET NULL')
      
      // Index
      table.index(['market_code_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['market_code_id'])
      table.dropIndex(['market_code_id'])
      table.dropColumn('market_code_id')
    })
  }
}