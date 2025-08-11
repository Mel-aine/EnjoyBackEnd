import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'employees'

  async up() {
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
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('employee_number').notNullable()

      table
        .integer('department_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('departments')
        .onDelete('CASCADE')

      table.string('job_title').notNullable()

      table.enum('employment_type', [
        'FullTime',
        'PartTime',
        'Contract',
        'Temporary',
        'Intern',
      ]).notNullable()

      table.enum('employment_status', [
        'Active',
        'Inactive',
        'Terminated',
        'OnLeave',
        'Suspended',
      ]).notNullable()

      table.date('hire_date').notNullable()
      table.date('termination_date').nullable()
      table.string('termination_reason').nullable()

      table
        .integer('supervisor_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('employees')
        .onDelete('SET NULL')

      table.decimal('hourly_rate', 10, 2).nullable()
      table.decimal('salary', 15, 2).nullable()
      table.string('currency_code', 3).notNullable()

      table.enu('pay_frequency', [
        'Weekly',
        'BiWeekly',
        'Monthly',
        'Quarterly',
        'Annually',
      ]).nullable()

      table.boolean('overtime_eligible').notNullable()

      table.integer('vacation_days_per_year').nullable()
      table.integer('sick_days_per_year').nullable()
      table.integer('personal_days_per_year').nullable()

      table.integer('vacation_days_used').notNullable()
      table.integer('sick_days_used').notNullable()
      table.integer('personal_days_used').notNullable()

      table.string('emergency_contact_name').nullable()
      table.string('emergency_contact_phone').nullable()
      table.string('emergency_contact_relationship').nullable()

      table.string('work_location').nullable()
      table.string('shift_pattern').nullable()
      table.string('access_level').nullable()

      table.json('certifications').nullable()
      table.json('skills').nullable()

      table.string('performance_rating').nullable()
      table.date('last_performance_review').nullable()
      table.date('next_performance_review').nullable()
      table.text('notes').nullable()

      table.boolean('is_active').notNullable()

      table
        .integer('created_by')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table
        .integer('last_modified_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
