import { BaseSchema } from '@adonisjs/lucid/schema'


export default class DropDiscountsTable extends BaseSchema {
  protected tableName = 'discounts'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop all columns except 'id'
      table.dropColumns(
        'hotel_id',
        'short_code',
        'name',
        'type',
        'open_discount',
        'value',
        'created_by_user_id',
        'updated_by_user_id',
        'created_at',
        'updated_at'
      )
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Recreate the dropped columns in case of rollback
      table.integer('hotel_id').unsigned().notNullable()
      table.string('short_code', 50).notNullable()
      table.string('name', 255).notNullable()
      table.enum('type', ['percentage', 'flat']).notNullable()
      table.boolean('open_discount').defaultTo(false).notNullable()
      table.decimal('value', 10, 2).notNullable()
      table.enum('status', ['active', 'inactive']).defaultTo('active').notNullable()
      table.integer('created_by_user_id').unsigned().nullable()
      table.integer('updated_by_user_id').unsigned().nullable()
      table.boolean('is_deleted').defaultTo(false).notNullable()
      table.timestamp('deleted_at', { useTz: true }).nullable()
      table.timestamps(true, true)
    })
  }
}