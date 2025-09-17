import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_groups'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')

      table.string('group_name').notNullable()
      table.string('group_code').nullable()

      table
        .enu('group_type', ['Corporate', 'Tour', 'Wedding', 'Conference', 'Convention', 'Sports', 'Other'])
        .notNullable()

      table.string('contact_person_name').notNullable()
      table.string('contact_person_email').nullable()
      table.string('contact_person_phone').nullable()
      table.string('company_organization').nullable()

      table.date('arrival_date').notNullable()
      table.date('departure_date').notNullable()

      table.integer('total_rooms_requested').notNullable()
      table.integer('total_guests').notNullable()
      table.integer('adults_count').notNullable()
      table.integer('children_count').notNullable()

      table.decimal('group_rate', 10, 2).nullable()
      table.string('currency_code').notNullable()

      table.text('special_requests').nullable()
      table.text('catering_requirements').nullable()
      table.text('meeting_room_requirements').nullable()
      table.text('transportation_needs').nullable()
      table.text('billing_instructions').nullable()
      table.text('payment_terms').nullable()

      table
        .enu('group_status', ['Inquiry', 'Tentative', 'Confirmed', 'Cancelled', 'CheckedIn', 'CheckedOut', 'Completed'])
        .notNullable()

      table.boolean('contract_signed').notNullable().defaultTo(false)
      table.timestamp('contract_signed_date', { useTz: true }).nullable()

      table.decimal('deposit_required', 10, 2).nullable()
      table.decimal('deposit_paid', 10, 2).nullable()
      table.timestamp('deposit_due_date', { useTz: true }).nullable()

      table.text('cancellation_policy').nullable()
      table.timestamp('cancellation_deadline', { useTz: true }).nullable()

      table.text('notes').nullable()

      table.integer('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('last_modified_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())


    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
