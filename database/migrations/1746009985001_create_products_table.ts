import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('code', 50).nullable()
      table.string('name').notNullable()
      table.text('description').nullable()
      // table.integer('quantity').notNullable().defaultTo(0)
      table.decimal('price', 10, 2).notNullable().defaultTo(0.00)
      table.integer('quantity_available').defaultTo(0).notNullable()
      table.integer('min_stock_level').defaultTo(5).notNullable()
      table.boolean('is_available').defaultTo(true).notNullable()
      table.json('availability_schedule').nullable()
      table.string('product_image', 255).nullable()
      table.string('supplier_name').nullable()
      table.boolean('customization_allowed').defaultTo(false).nullable()
      table.enu('payment_type', ['direct', 'deferred', 'both']).defaultTo('deferred').nullable()
      table.enu('status', ['active', 'inactive', 'out_of_stock', 'discontinued', 'coming_soon'])
      .defaultTo('active').notNullable()
      table
        .integer('service_id')
        .unsigned()
        .references('id')
        .inTable('services')
        .onDelete('SET NULL')
        .nullable()

        table
        .integer('product_type_id')
        .unsigned()
        .references('id')
        .inTable('product_types')
        .onDelete('SET NULL')
        .nullable()

        // table.integer('department_id').unsigned().nullable()
        // .references('id').inTable('departments').onDelete('SET NULL')

      // table
      //   .integer('supplier_id')
      //   .unsigned()
      //   .references('id')
      //   .inTable('suppliers')
      //   .onDelete('SET NULL')
      //   .nullable()

      table
        .integer('stock_category_id')
        .unsigned()
        .references('id')
        .inTable('stock_categories')
        .onDelete('SET NULL')
        .nullable()

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
