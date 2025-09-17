import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Change tax_rate from decimal(5,4) to decimal(8,4) to allow values like 10.5, 99.99, etc.
      table.decimal('tax_rate', 8, 4).defaultTo(0).alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Revert back to original precision
      table.decimal('tax_rate', 5, 4).defaultTo(0).alter()
    })
  }
}