import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Hub OTA (connect-hub): links enjoy to the hub that sells rooms on local OTAs.
 *
 * Only nullable columns: an hotel without hub settings behaves exactly as
 * before, and Channex fields are left untouched.
 *
 * Written with `IF [NOT] EXISTS` because a database restored from a copy may
 * already carry some of these columns (`hotels.hub_property_id` was added by
 * hand in some installations); without it the whole migration aborts on the
 * first duplicate and the remaining columns are never created.
 */
export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      ALTER TABLE hotels
        ADD COLUMN IF NOT EXISTS hub_property_id integer,
        ADD COLUMN IF NOT EXISTS hub_api_key text,
        ADD COLUMN IF NOT EXISTS hub_webhook_secret text
    `)

    await this.db.rawQuery(
      `ALTER TABLE room_types ADD COLUMN IF NOT EXISTS hub_room_type_id integer`
    )

    await this.db.rawQuery(`ALTER TABLE room_rates ADD COLUMN IF NOT EXISTS hub_rate_plan_id integer`)

    await this.db.rawQuery(`
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS hub_booking_id integer,
        ADD COLUMN IF NOT EXISTS hub_revision_seq integer,
        ADD COLUMN IF NOT EXISTS hub_cancel_synced_at timestamp
    `)

    // Unique: two concurrent feed reads (webhook + cron) cannot create the same
    // booking twice. NULLs are distinct in Postgres, so non-hub reservations are
    // not affected.
    await this.db.rawQuery(`
      CREATE UNIQUE INDEX IF NOT EXISTS reservations_hotel_hub_booking_unique
        ON reservations (hotel_id, hub_booking_id)
    `)

    await this.db.rawQuery(`
      ALTER TABLE reservation_rooms
        ADD COLUMN IF NOT EXISTS hub_sold_from date,
        ADD COLUMN IF NOT EXISTS hub_sold_to date,
        ADD COLUMN IF NOT EXISTS hub_room_type_id integer
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE reservation_rooms
        DROP COLUMN IF EXISTS hub_sold_from,
        DROP COLUMN IF EXISTS hub_sold_to,
        DROP COLUMN IF EXISTS hub_room_type_id
    `)

    await this.db.rawQuery(
      `DROP INDEX IF EXISTS reservations_hotel_hub_booking_unique`
    )
    await this.db.rawQuery(`
      ALTER TABLE reservations
        DROP COLUMN IF EXISTS hub_booking_id,
        DROP COLUMN IF EXISTS hub_revision_seq,
        DROP COLUMN IF EXISTS hub_cancel_synced_at
    `)

    await this.db.rawQuery(`ALTER TABLE room_rates DROP COLUMN IF EXISTS hub_rate_plan_id`)
    await this.db.rawQuery(`ALTER TABLE room_types DROP COLUMN IF EXISTS hub_room_type_id`)
    await this.db.rawQuery(`
      ALTER TABLE hotels
        DROP COLUMN IF EXISTS hub_property_id,
        DROP COLUMN IF EXISTS hub_api_key,
        DROP COLUMN IF EXISTS hub_webhook_secret
    `)
  }
}
