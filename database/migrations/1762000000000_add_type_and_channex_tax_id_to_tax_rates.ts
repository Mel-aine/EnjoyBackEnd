import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tax_rates'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add tax type enum with three possible values
      table
        .enum('type', ['vat', 'service_fee', 'city_tax'])
        .nullable()
        .comment('Categorizes tax rate into VAT, service fee, or city tax')

      // Add external Channex tax ID, set during tax migration
      table.string('channex_tax_id', 64).nullable().comment('External Channex tax identifier')

      // Optional index for quick lookup by external ID
      table.index(['channex_tax_id'])
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['channex_tax_id'])
      table.dropColumn('channex_tax_id')
      table.dropColumn('type')
    })
  }
}