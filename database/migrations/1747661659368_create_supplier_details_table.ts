import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'supplier_details'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('user_id').unsigned().primary()
      table.string('company_name', 255).notNullable()
      table.string('contact_person', 255).nullable()
      table.text('address').nullable()
      table.string('website', 255).nullable()
      table.string('tax_id', 100).nullable()
      table.string('payment_terms', 255).nullable()
      table.decimal('supplier_rating', 3, 2).defaultTo(0.0).nullable()
      table.text('notes').nullable()

      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}