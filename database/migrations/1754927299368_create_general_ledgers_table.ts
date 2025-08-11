import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'general_ledgers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('hotel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')

      table.timestamp('transaction_datetime', { useTz: true }).notNullable()

      table
        .integer('debit_account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('chart_of_accounts')
        .onDelete('RESTRICT')

      table
        .integer('credit_account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('chart_of_accounts')
        .onDelete('RESTRICT')

      table.decimal('amount', 12, 2).notNullable()
      table.text('description').notNullable()

      table.string('document_reference', 100).nullable()

      table
        .enu('source_type', [
          'Folio',
          'SupplierInvoice',
          'BankTransfer',
          'Payroll',
          'ManualAdjustment',
          'PurchaseOrder',
          'TaxPayment',
          'AssetDepreciation',
          'RevenueRecognition',
        ])
        .notNullable()

      table.string('source_id_reference', 50).nullable()

      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Index utile pour les recherches fréquentes
      table.index(['hotel_id', 'transaction_datetime'], 'idx_hotel_transaction_date')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
