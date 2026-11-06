import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    const hasInvoiceTemplate = await this.schema.hasColumn(this.tableName, 'invoice_template')

    if (!hasInvoiceTemplate) {
      this.schema.alterTable(this.tableName, (table) => {
        table.string('invoice_template', 20).notNullable().defaultTo('standard')
      })
    }
  }

  async down() {
    const hasInvoiceTemplate = await this.schema.hasColumn(this.tableName, 'invoice_template')

    if (hasInvoiceTemplate) {
      this.schema.alterTable(this.tableName, (table) => {
        if (hasInvoiceTemplate) {
          table.dropColumn('invoice_template')
        }
      })
    }
  }
}
