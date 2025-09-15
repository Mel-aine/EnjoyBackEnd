import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add hotel management specific fields

      table.integer('guest_id').unsigned().nullable().after('user_id')
      table.integer('room_type_id').unsigned().nullable().after('service_id')
      table.integer('booking_source_id').unsigned().nullable().after('room_type_id')
      table.integer('rate_plan_id').unsigned().nullable().after('booking_source_id')
      table.integer('discount_id').unsigned().nullable().after('rate_plan_id')
      table.integer('group_id').unsigned().nullable().after('discount_id')

      // Enhanced reservation details
      table.string('confirmation_number', 50).unique().nullable().after('reservation_number')
      table.time('check_in_time').nullable().after('check_out_date')
      table.time('check_out_time').nullable().after('check_in_time')
      table.integer('nights').nullable().after('check_out_time')
      table.integer('adults').defaultTo(1).after('guest_count')
      table.integer('children').defaultTo(0).after('adults')
      table.integer('infants').defaultTo(0).after('children')
      table.integer('rooms_requested').defaultTo(1).after('infants')

      // Pricing details
      table.decimal('room_rate', 10, 2).nullable().after('total_amount')
      table.decimal('extra_charges', 10, 2).defaultTo(0).after('room_rate')
      table.decimal('service_charges', 10, 2).defaultTo(0).after('extra_charges')
      table.decimal('commission_amount', 10, 2).defaultTo(0).after('service_charges')

      // Status and workflow
      table.enum('reservation_status', [
        'inquiry', 'tentative', 'confirmed', 'checked_in',
        'checked_out', 'cancelled', 'no_show', 'waitlisted'
      ]).defaultTo('inquiry').after('status')

      table.enum('guarantee_type', [
        'none', 'credit_card', 'deposit', 'corporate', 'travel_agent'
      ]).nullable().after('reservation_status')

      // Guest preferences and special requirements
      table.json('room_preferences').nullable().after('special_requests')
      table.json('guest_preferences').nullable().after('room_preferences')
      table.text('internal_notes').nullable().after('guest_preferences')
      table.boolean('vip_guest').defaultTo(false).after('internal_notes')
      table.string('vip_level', 20).nullable().after('vip_guest')

      // Booking and modification tracking
      table.timestamp('booking_date').nullable().after('vip_level')
      table.timestamp('modification_date').nullable().after('booking_date')
      table.timestamp('cancellation_date').nullable().after('modification_date')
      table.integer('cancelled_by').unsigned().nullable().after('cancellation_date')

      // Marketing and source tracking
      table.string('market_segment', 50).nullable().after('cancelled_by')
      table.string('source_of_business', 100).nullable().after('market_segment')
      table.string('promo_code', 50).nullable().after('source_of_business')

      // Communication preferences
      table.boolean('email_confirmation_sent').defaultTo(false).after('promo_code')
      table.boolean('sms_confirmation_sent').defaultTo(false).after('email_confirmation_sent')
      table.timestamp('last_communication_date').nullable().after('sms_confirmation_sent')

      // Add foreign key constraints

      table.foreign('guest_id').references('id').inTable('guests').onDelete('SET NULL')
      table.foreign('room_type_id').references('id').inTable('room_types').onDelete('SET NULL')
      table.foreign('booking_source_id').references('id').inTable('booking_sources').onDelete('SET NULL')
      table.foreign('cancelled_by').references('id').inTable('users').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop foreign key constraints first

      table.dropForeign(['guest_id'])
      table.dropForeign(['room_type_id'])
      table.dropForeign(['booking_source_id'])
      table.dropForeign(['cancelled_by'])

      // Drop columns

      table.dropColumn('guest_id')
      table.dropColumn('room_type_id')
      table.dropColumn('booking_source_id')
      table.dropColumn('rate_plan_id')
      table.dropColumn('discount_id')
      table.dropColumn('group_id')
      table.dropColumn('confirmation_number')
      table.dropColumn('check_in_time')
      table.dropColumn('check_out_time')
      table.dropColumn('nights')
      table.dropColumn('adults')
      table.dropColumn('children')
      table.dropColumn('infants')
      table.dropColumn('rooms_requested')
      table.dropColumn('room_rate')
      table.dropColumn('extra_charges')
      table.dropColumn('service_charges')
      table.dropColumn('commission_amount')
      table.dropColumn('reservation_status')
      table.dropColumn('guarantee_type')
      table.dropColumn('room_preferences')
      table.dropColumn('guest_preferences')
      table.dropColumn('internal_notes')
      table.dropColumn('vip_guest')
      table.dropColumn('vip_level')
      table.dropColumn('booking_date')
      table.dropColumn('modification_date')
      table.dropColumn('cancellation_date')
      table.dropColumn('cancelled_by')
      table.dropColumn('market_segment')
      table.dropColumn('source_of_business')
      table.dropColumn('promo_code')
      table.dropColumn('email_confirmation_sent')
      table.dropColumn('sms_confirmation_sent')
      table.dropColumn('last_communication_date')
    })
  }
}
