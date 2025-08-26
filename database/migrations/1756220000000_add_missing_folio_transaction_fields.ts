import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add missing fields that are used in the model but don't exist in the database
      table.string('subcategory').nullable()
      table.decimal('tax_rate', 5, 4).nullable()
      table.integer('discount_id').unsigned().nullable()
      table.string('comp_reason').nullable()
      table.boolean('is_taxable').defaultTo(true)
      table.boolean('tax_exempt').defaultTo(false)
      table.string('tax_exempt_reason').nullable()
      table.boolean('print_on_bill').defaultTo(true)
      table.string('print_description').nullable()
      table.boolean('hide_from_guest').defaultTo(false)
      
      // Add foreign key for discount_id
      table.foreign('discount_id').references('id').inTable('discounts').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['discount_id'])
      table.dropColumn('subcategory')
      table.dropColumn('tax_rate')
      table.dropColumn('discount_id')
      table.dropColumn('comp_reason')
      table.dropColumn('is_taxable')
      table.dropColumn('tax_exempt')
      table.dropColumn('tax_exempt_reason')
      table.dropColumn('print_on_bill')
      table.dropColumn('print_description')
      table.dropColumn('hide_from_guest')
    })
  }
}