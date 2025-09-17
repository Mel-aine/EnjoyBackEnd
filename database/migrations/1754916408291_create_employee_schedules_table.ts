import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'employee_schedules'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('employee_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('employees')
        .onDelete('CASCADE')
      table.date('schedule_date').notNullable()
      table.time('shift_start_time').notNullable()
      table.time('shift_end_time').notNullable()
      table.string('assigned_task_category', 255).nullable()
      table.text('notes').nullable()
      table.boolean('is_published').notNullable().defaultTo(false)
      table.enu('swap_request_status', ['None', 'Requested', 'Approved', 'Rejected']).notNullable()
      table
        .integer('requested_by_employee_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('employees')
        .onDelete('SET NULL')
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
