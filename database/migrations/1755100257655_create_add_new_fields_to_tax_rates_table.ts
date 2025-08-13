import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tax_rates'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('short_name').nullable()
      table.date('applies_from').nullable()
      table.date('exempt_after').nullable()
      table.string('posting_type').nullable() // 'flat_amount', 'flat_percentage', 'slab'
      table.decimal('amount', 10, 2).nullable() // if posting_type = flat_amount
      table.decimal('percentage', 5, 2).nullable() // if posting_type = flat_percentage
      table.text('slab_info').nullable() // if posting_type = slab
      table.string('apply_tax').nullable() // 'before_discount', 'after_discount'
      table.boolean('apply_tax_on_rack_rate').defaultTo(false)
      table.string('status').nullable() // 'active', 'inactive'
      table.text('tax_apply_after').nullable() // list of taxes to apply before this tax
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('short_name')
      table.dropColumn('applies_from')
      table.dropColumn('exempt_after')
      table.dropColumn('posting_type')
      table.dropColumn('amount')
      table.dropColumn('percentage')
      table.dropColumn('slab_info')
      table.dropColumn('apply_tax')
      table.dropColumn('apply_tax_on_rack_rate')
      table.dropColumn('status')
      table.dropColumn('tax_apply_after')
    })
  }
}