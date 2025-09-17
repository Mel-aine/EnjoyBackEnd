import { BaseSchema } from '@adonisjs/lucid/schema'

export default class  extends BaseSchema {
  protected tableName = 'bank_transactions'

  public async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('bank_account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('bank_accounts')
        .onDelete('CASCADE')

      table.date('transaction_date').notNullable()

      table
        .enum('transaction_type', [
          'Deposit',
          'Withdrawal',
          'Fee',
          'Interest',
          'TransferIn',
          'TransferOut',
          'Chargeback',
        ])
        .notNullable()

      table.decimal('amount', 12, 2).notNullable()

      table.text('description').nullable()

      table.boolean('is_reconciled').notNullable().defaultTo(false)
      table.dateTime('reconciliation_datetime').nullable()

      table
        .integer('gl_entry_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('general_ledgers')
        .onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    }
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
