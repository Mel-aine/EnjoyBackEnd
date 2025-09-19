import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateDiscountsTable extends BaseSchema {
  protected tableName = 'discounts'

  public async up() {
     this.schema.alterTable(this.tableName, (table) => {
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE') // Foreign key to hotels
      table.string('short_code', 50).notNullable() // Short code for the discount
      table.string('name', 255).notNullable() // Name of the discount
      table.enum('type', ['percentage', 'flat']).notNullable() // Discount type
      table.boolean('open_discount').defaultTo(false).notNullable() // Whether the discount is open
      table.decimal('value', 10, 2).notNullable() // Discount value
      table.enum('status', ['active', 'inactive']).defaultTo('active').notNullable() // Discount status

      // Audit fields
      table.integer('created_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL').onUpdate('CASCADE')
      table.integer('updated_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL').onUpdate('CASCADE')
      table.boolean('is_deleted').defaultTo(false).notNullable()
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.timestamps(true, true) // created_at and updated_at
    })
  }

  public async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}