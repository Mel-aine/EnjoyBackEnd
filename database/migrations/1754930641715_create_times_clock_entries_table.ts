import { BaseSchema } from '@adonisjs/lucid/schema'

export default class  extends BaseSchema {
  protected tableName = 'time_clock_entries'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('employee_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('employees')
        .onDelete('CASCADE')

      table.dateTime('clock_in_datetime').notNullable()
      table.dateTime('clock_out_datetime').nullable()
      table.dateTime('break_start_datetime').nullable()
      table.dateTime('break_end_datetime').nullable()

      table.decimal('total_hours_worked', 5, 2).nullable()

      table.boolean('is_validated').notNullable().defaultTo(false)

      table
        .integer('validated_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.dateTime('validation_datetime').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
