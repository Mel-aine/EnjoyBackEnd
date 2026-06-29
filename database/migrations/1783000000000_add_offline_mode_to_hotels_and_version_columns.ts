import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ============================================
    // 1. Add offline_mode_enabled to hotels
    // ============================================
    this.schema.alterTable('hotels', (table) => {
      table.boolean('offline_mode_enabled').notNullable().defaultTo(false)
    })

    // ============================================
    // 2. Add version column to key tables
    // ============================================
    this.schema.alterTable('reservations', (table) => {
      table.integer('version').notNullable().defaultTo(1)
    })
    this.schema.alterTable('folios', (table) => {
      table.integer('version').notNullable().defaultTo(1)
    })
    this.schema.alterTable('folio_transactions', (table) => {
      table.integer('version').notNullable().defaultTo(1)
    })
    this.schema.alterTable('guests', (table) => {
      table.integer('version').notNullable().defaultTo(1)
    })
    this.schema.alterTable('rooms', (table) => {
      table.integer('version').notNullable().defaultTo(1)
    })

    // ============================================
    // 3. Create sync_version_seq sequence
    // ============================================
    this.schema.raw(`
      CREATE SEQUENCE IF NOT EXISTS sync_version_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;
    `)

    // ============================================
    // 4. Create indexes on updated_at for incremental sync
    // ============================================
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_reservations_updated ON reservations(updated_at);
      CREATE INDEX IF NOT EXISTS idx_folios_updated ON folios(updated_at);
      CREATE INDEX IF NOT EXISTS idx_folio_transactions_updated ON folio_transactions(updated_at);
      CREATE INDEX IF NOT EXISTS idx_guests_updated ON guests(updated_at);
      CREATE INDEX IF NOT EXISTS idx_rooms_updated ON rooms(updated_at);
    `)
  }

  async down() {
    this.schema.raw(`
      DROP INDEX IF EXISTS idx_rooms_updated;
      DROP INDEX IF EXISTS idx_guests_updated;
      DROP INDEX IF EXISTS idx_folio_transactions_updated;
      DROP INDEX IF EXISTS idx_folios_updated;
      DROP INDEX IF EXISTS idx_reservations_updated;
      DROP SEQUENCE IF EXISTS sync_version_seq;
    `)

    this.schema.alterTable('rooms', (table) => {
      table.dropColumn('version')
    })
    this.schema.alterTable('guests', (table) => {
      table.dropColumn('version')
    })
    this.schema.alterTable('folio_transactions', (table) => {
      table.dropColumn('version')
    })
    this.schema.alterTable('folios', (table) => {
      table.dropColumn('version')
    })
    this.schema.alterTable('reservations', (table) => {
      table.dropColumn('version')
    })
    this.schema.alterTable('hotels', (table) => {
      table.dropColumn('offline_mode_enabled')
    })
  }
}
