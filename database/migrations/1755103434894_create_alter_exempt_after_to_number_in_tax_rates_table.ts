import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tax_rates'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('exempt_after')
    })
    
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('exempt_after').nullable() // Change from date to number
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('exempt_after')
    })
    
    this.schema.alterTable(this.tableName, (table) => {
      table.date('exempt_after').nullable() // Revert back to date
    })
  }
}