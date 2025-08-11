import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'inventory_items'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('hotel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')

      table
        .integer('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('inventory_categories')
        .onDelete('CASCADE')

      table.string('item_name', 255).notNullable()

      table
        .enu('unit_of_measure', ['unit','kg','liter','box','piece','gallon','pound','meter','case','pack','bottle','can','roll','sheet','other',
        ])
        .notNullable()

      table.decimal('min_stock_quantity', 10, 2).notNullable().defaultTo(0.0)
      table.decimal('average_purchase_price', 10, 2).notNullable().defaultTo(0.0)

      table.text('description').nullable()

      table
        .string('sku', 100)
        .nullable()
        .unique()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
