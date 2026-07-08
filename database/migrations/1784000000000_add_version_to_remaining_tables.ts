import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ============================================
    // 1. Add version column to remaining tables
    // ============================================
    const tablesWithVersion = [
      'room_types',
      'rate_types',
      'room_rates',
      'extra_charges',
      'booking_sources',
      'payment_methods',
      'tax_rates',
      'discounts',
      'work_orders',
      'room_blocks',
      'vip_statuses',
      'black_list_reasons',
      'notifications',
      'announcements',
    ]

    for (const table of tablesWithVersion) {
      this.schema.alterTable(table, (t) => {
        t.integer('version').notNullable().defaultTo(1)
      })
    }

    // ============================================
    // 2. Add updated_at indexes for incremental sync
    // ============================================
    // Note: announcements has no updated_at column (uses created_at instead)
    const tablesWithUpdatedAt = tablesWithVersion.filter(t => t !== 'announcements')
    for (const table of tablesWithUpdatedAt) {
      this.schema.raw(`
        CREATE INDEX IF NOT EXISTS idx_${table}_updated ON ${table}(updated_at);
      `)
    }
  }

  async down() {
    const tablesWithVersion = [
      'room_types',
      'rate_types',
      'room_rates',
      'extra_charges',
      'booking_sources',
      'payment_methods',
      'tax_rates',
      'discounts',
      'work_orders',
      'room_blocks',
      'vip_statuses',
      'black_list_reasons',
      'notifications',
      'announcements',
    ]

    const tablesWithUpdatedAt = tablesWithVersion.filter(t => t !== 'announcements')
    for (const table of tablesWithUpdatedAt) {
      this.schema.raw(`DROP INDEX IF EXISTS idx_${table}_updated;`)
      this.schema.alterTable(table, (t) => {
        t.dropColumn('version')
      })
    }
  }
}
