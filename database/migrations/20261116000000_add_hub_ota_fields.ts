import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Hub OTA (connect-hub): links enjoy to the hub that sells rooms on local OTAs.
 *
 * Only nullable columns: an hotel without hub settings behaves exactly as
 * before, and Channex fields are left untouched.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('hotels', (table) => {
      table.integer('hub_property_id').nullable()
      // Encrypted with APP_KEY (see Hotel model), never serialized.
      table.text('hub_api_key').nullable()
      table.text('hub_webhook_secret').nullable()
    })

    this.schema.alterTable('room_types', (table) => {
      table.integer('hub_room_type_id').nullable()
    })

    this.schema.alterTable('room_rates', (table) => {
      table.integer('hub_rate_plan_id').nullable()
    })

    this.schema.alterTable('reservations', (table) => {
      table.integer('hub_booking_id').nullable()
      table.integer('hub_revision_seq').nullable()
      // When the hub was told about a cancellation made in enjoy (null = still to send).
      table.timestamp('hub_cancel_synced_at').nullable()
      // Unique: two concurrent feed reads (webhook + cron) cannot create the same booking twice.
      // NULLs are distinct in Postgres, so non-hub reservations are not affected.
      table.unique(['hotel_id', 'hub_booking_id'], {
        indexName: 'reservations_hotel_hub_booking_unique',
      })
    })

    this.schema.alterTable('reservation_rooms', (table) => {
      // What the hub sold for this room: nights [from, to) of this enjoy room
      // type. Only those nights are left out of the stock sent to the hub, so
      // an extension, a move or an upgrade made in enjoy is still counted.
      table.date('hub_sold_from').nullable()
      table.date('hub_sold_to').nullable()
      table.integer('hub_room_type_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable('reservation_rooms', (table) => {
      table.dropColumn('hub_sold_from')
      table.dropColumn('hub_sold_to')
      table.dropColumn('hub_room_type_id')
    })

    this.schema.alterTable('reservations', (table) => {
      table.dropUnique(['hotel_id', 'hub_booking_id'], 'reservations_hotel_hub_booking_unique')
      table.dropColumn('hub_booking_id')
      table.dropColumn('hub_revision_seq')
      table.dropColumn('hub_cancel_synced_at')
    })

    this.schema.alterTable('room_rates', (table) => {
      table.dropColumn('hub_rate_plan_id')
    })

    this.schema.alterTable('room_types', (table) => {
      table.dropColumn('hub_room_type_id')
    })

    this.schema.alterTable('hotels', (table) => {
      table.dropColumn('hub_property_id')
      table.dropColumn('hub_api_key')
      table.dropColumn('hub_webhook_secret')
    })
  }
}
