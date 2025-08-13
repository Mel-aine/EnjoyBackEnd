import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tax_rate_dependencies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tax_rate_id').unsigned().notNullable()
      table.integer('depends_on_tax_rate_id').unsigned().notNullable()
      
      table.foreign('tax_rate_id').references('tax_rate_id').inTable('tax_rates').onDelete('CASCADE')
      table.foreign('depends_on_tax_rate_id').references('tax_rate_id').inTable('tax_rates').onDelete('CASCADE')
      
      table.unique(['tax_rate_id', 'depends_on_tax_rate_id'])
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}