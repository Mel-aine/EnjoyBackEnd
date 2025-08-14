import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'extra_charges'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE')
      table.string('short_code', 50).notNullable()
      table.string('name', 255).notNullable()
      table.decimal('rate', 10, 2).notNullable().defaultTo(0)
      table.decimal('rate_inclusive_tax', 10, 2).notNullable().defaultTo(0)
      table.boolean('fixed_price').notNullable().defaultTo(false)
      table.integer('front_desk_sort_key').notNullable().defaultTo(1)
      table.boolean('publish_on_web').notNullable().defaultTo(false)
      table.string('voucher_no', 100).notNullable().defaultTo('auto_general')
      table.text('description').nullable()
      table.integer('web_res_sort_key').notNullable().defaultTo(0)
      table.date('valid_from').notNullable()
      table.date('valid_to').notNullable()
      table.string('charge_applies_on', 50).notNullable().defaultTo('per_quantity')
      table.string('apply_charge_on', 50).notNullable().defaultTo('only_on_check_in')
      table.boolean('apply_charge_always').notNullable().defaultTo(false)
      
      // Audit fields
      table.integer('created_by_user_id').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by_user_id').unsigned().nullable().references('id').inTable('users')
      table.boolean('is_deleted').notNullable().defaultTo(false)
      table.dateTime('deleted_at').nullable()
      
      table.timestamp('created_at')
      table.timestamp('updated_at')
      
      // Indexes
      table.index(['hotel_id'])
      table.index(['short_code'])
      table.index(['is_deleted'])
      table.index(['valid_from', 'valid_to'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}