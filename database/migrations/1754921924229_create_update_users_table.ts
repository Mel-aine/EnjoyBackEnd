import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
        table.integer('hotel_id').unsigned().nullable()
            .references('id').inTable('hotels')
            .onDelete('CASCADE')
        table.text('username')
        table
        .integer('employee_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('employees')
        .onDelete('CASCADE')
        table.boolean('is_active').notNullable().defaultTo(true)
        table.string('preferred_language').nullable()
        table.enum('theme_preference', ['Blue', 'Black', 'Silver', 'SystemDefault']).nullable()
        table.boolean('is_cdi').notNullable().defaultTo(false)



    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('hotel_id')
      table.dropColumn('username')
      table.dropColumn('employee_id')
      table.dropColumn('is_active')
      table.dropColumn('preferred_language')
      table.dropColumn('theme_preference')
      table.dropColumn('is_cdi')
    })
  }
}
