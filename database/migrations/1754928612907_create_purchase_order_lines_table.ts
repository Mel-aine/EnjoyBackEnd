import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'purchase_order_lines'

  public async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('po_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('purchase_orders')
        .onDelete('CASCADE')

      table
        .integer('item_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('inventory_items')
        .onDelete('CASCADE')

      table.decimal('ordered_quantity', 10, 2).notNullable()
      table.decimal('negotiated_unit_price', 10, 2).notNullable()
      table.decimal('received_quantity', 10, 2).notNullable().defaultTo(0.0)

      table.timestamp('last_receipt_datetime', { useTz: true }).nullable()
      table.text('notes').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    }
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
