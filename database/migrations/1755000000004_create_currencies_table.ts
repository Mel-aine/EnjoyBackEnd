import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'currencies'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('country', 100).notNullable()
      table.string('currency', 100).notNullable()
      table.string('sign', 10).notNullable()
      table.enum('prefix_suffix', ['prefix', 'suffix']).notNullable().defaultTo('prefix')
      table.string('currency_code', 10).notNullable()
      table.integer('digits_after_decimal').notNullable().defaultTo(2)
      table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1.0)
      table.boolean('is_editable').notNullable().defaultTo(true)
      table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE')
      
      // Audit fields
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      table.integer('created_by_user_id').unsigned().references('id').inTable('users').nullable()
      table.integer('updated_by_user_id').unsigned().references('id').inTable('users').nullable()
      table.boolean('is_deleted').notNullable().defaultTo(false)
      table.timestamp('deleted_at', { useTz: true }).nullable()
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}