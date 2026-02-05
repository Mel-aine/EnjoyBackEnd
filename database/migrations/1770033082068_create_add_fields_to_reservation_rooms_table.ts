// database/migrations/XXXX_add_zkteco_columns_to_reservation_rooms.ts

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('door_id').unsigned().nullable().references('doors.id').onDelete('SET NULL')
      table.string('user_id_on_device', 50).nullable()
      table.string('card_uid', 100).nullable()
      table.timestamp('access_granted_at').nullable()
      table.timestamp('access_revoked_at').nullable()
      table.enum('access_status', ['none', 'granted', 'expired', 'revoked']).nullable()

      // Index pour le cron d'expiration
      table.index(['access_status', 'check_out_date'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('door_id')
      table.dropColumn('user_id_on_device')
      table.dropColumn('card_uid')
      table.dropColumn('access_granted_at')
      table.dropColumn('access_revoked_at')
      table.dropColumn('access_status')
    })
  }
}
