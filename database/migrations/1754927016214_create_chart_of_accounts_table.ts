import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chart_of_accounts'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('hotel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')
        .unique()

      table.string('account_number', 20).notNullable().unique()
      table.string('account_name', 255).notNullable()

      table
        .enu('account_type', [
          'Asset',
          'Liability',
          'Equity',
          'Revenue',
          'Expense',
          'ContraAsset',
          'ContraLiability',
          'ContraEquity',
          'ContraRevenue',
          'ContraExpense',
        ])
        .notNullable()

      table
        .integer('parent_account_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('chart_of_accounts')
        .onDelete('SET NULL')

      table.boolean('is_active').notNullable().defaultTo(true)
      table.text('description').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
