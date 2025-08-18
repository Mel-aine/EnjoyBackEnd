import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Meal inclusions
      table.boolean('breakfast_included').defaultTo(false)
      table.boolean('lunch_included').defaultTo(false)
      table.boolean('dinner_included').defaultTo(false)
      table.boolean('drinks_included').defaultTo(false)
      
      // Technology services
      table.boolean('wifi_included').defaultTo(false)
      table.boolean('digital_key').defaultTo(false)
      table.boolean('mobile_check_in').defaultTo(false)
      
      // Transportation services
      table.boolean('parking_included').defaultTo(false)
      table.boolean('airport_transfer_included').defaultTo(false)
      
      // Facility access
      table.boolean('spa_access_included').defaultTo(false)
      table.boolean('gym_access_included').defaultTo(false)
      table.boolean('pool_access_included').defaultTo(false)
      table.boolean('business_center_included').defaultTo(false)
      
      // Hotel services
      table.boolean('concierge_service_included').defaultTo(false)
      table.boolean('room_service_included').defaultTo(false)
      table.boolean('laundry_service_included').defaultTo(false)
      table.boolean('turndown_service_included').defaultTo(false)
      table.boolean('daily_housekeeping_included').defaultTo(false)
      
      // Guest amenities
      table.boolean('newspaper_delivery').defaultTo(false)
      table.boolean('welcome_gift').defaultTo(false)
      table.boolean('room_decoration').defaultTo(false)
      
      // Special amenities
      table.boolean('champagne').defaultTo(false)
      table.boolean('flowers').defaultTo(false)
      table.boolean('chocolates').defaultTo(false)
      table.boolean('fruit_basket').defaultTo(false)
      
      // Check-in/out options (early_check_in and late_check_out already exist)
      table.boolean('express_check_out').defaultTo(false)
      
      // Room configurations
      table.boolean('extra_bed').defaultTo(false)
      table.boolean('crib').defaultTo(false)
      table.boolean('rollaway_bed').defaultTo(false)
      table.boolean('connecting_rooms').defaultTo(false)
      
      // Package options (package_rate already exists, adding package_inclusions as text)
      table.text('package_inclusions').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop all added boolean fields
      table.dropColumn('breakfast_included')
      table.dropColumn('lunch_included')
      table.dropColumn('dinner_included')
      table.dropColumn('drinks_included')
      table.dropColumn('wifi_included')
      table.dropColumn('digital_key')
      table.dropColumn('mobile_check_in')
      table.dropColumn('parking_included')
      table.dropColumn('airport_transfer_included')
      table.dropColumn('spa_access_included')
      table.dropColumn('gym_access_included')
      table.dropColumn('pool_access_included')
      table.dropColumn('business_center_included')
      table.dropColumn('concierge_service_included')
      table.dropColumn('room_service_included')
      table.dropColumn('laundry_service_included')
      table.dropColumn('turndown_service_included')
      table.dropColumn('daily_housekeeping_included')
      table.dropColumn('newspaper_delivery')
      table.dropColumn('welcome_gift')
      table.dropColumn('room_decoration')
      table.dropColumn('champagne')
      table.dropColumn('flowers')
      table.dropColumn('chocolates')
      table.dropColumn('fruit_basket')
      table.dropColumn('express_check_out')
      table.dropColumn('extra_bed')
      table.dropColumn('crib')
      table.dropColumn('rollaway_bed')
      table.dropColumn('connecting_rooms')
      table.dropColumn('package_inclusions')
    })
  }
}