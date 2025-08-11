import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date('date_of_birth').nullable()
      table.string('place_of_birth').nullable()
      table.string('gender').nullable()
      table.string('city').nullable()
      table.string('country').nullable()
      table.string('emergency_phone').nullable()
      table.string('personal_email').nullable().unique()
      table.string('social_security_number').nullable().unique()
      table.string('national_id_number').nullable().unique()
      table.date('hire_date').nullable()
      table.string('contract_type').nullable()
      table.date('contract_end_date').nullable()
      table.boolean('data_processing_consent').notNullable().defaultTo(false)
      table.date('consent_date').nullable()
      table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('SET NULL').nullable()
      table.text('username')
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.integer('employee_id').nullable()
      table.boolean('is_active').notNullable()
      table.string('preferred_language').nullable()
      table.enum('theme_preference', ['Blue', 'Black', 'Silver', 'SystemDefault']).nullable()
      table.boolean('is_cdi').notNullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('date_of_birth')
      table.dropColumn('place_of_birth')
      table.dropColumn('gender')
      table.dropColumn('city')
      table.dropColumn('country')
      table.dropColumn('emergency_phone')
      table.dropColumn('personal_email')
      table.dropColumn('social_security_number')
      table.dropColumn('national_id_number')
      table.dropColumn('hire_date')
      table.dropColumn('contract_type')
      table.dropColumn('contract_end_date')
      table.dropColumn('data_processing_consent')
      table.dropColumn('consent_date')
      table.dropColumn('username')
      table.dropColumn('employee_id')
      table.dropColumn('is_active')
      table.dropColumn('preferred_language')
      table.dropColumn('theme_preference')
      table.dropColumn('is_cdi')
      table.dropForeign(['hotel_id'])
      table.integer('created_by').notNullable().unsigned().alter()
      table.integer('last_modified_by').notNullable().unsigned().alter()

    })
  }
}
