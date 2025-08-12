import { BaseSchema } from '@adonisjs/lucid/schema'


export default class  extends BaseSchema {
  protected tableName = 'inventory_adjustments'

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
        .integer('item_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('inventory_items')
        .onDelete('CASCADE')

      table.enu('adjustment_type', ['CountAdjustment','Wastage','Spoilage','Theft','ReturnToSupplier','TransferOut','TransferIn','Damage','Loss']).notNullable()
      table.decimal('quantity_adjusted', 10, 2).notNullable()
      table.timestamp('adjustment_datetime', { useTz: true }).notNullable()
      table.text('reason').nullable()

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
