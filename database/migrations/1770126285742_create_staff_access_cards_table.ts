// database/migrations/XXXX_create_staff_access_cards_table.ts

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'staff_access_cards'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Informations du staff
      table.integer('user_id').unsigned().nullable()
        .references('id').inTable('users').onDelete('CASCADE')
      table.string('staff_first_name', 100).nullable()
      table.string('staff_last_name', 100).nullable()
      table.string('staff_position', 100).nullable()
      table.string('staff_phone_number', 20).nullable()
      table.string('card_uid', 50).notNullable().unique()
      table.string('user_id_on_device', 50).notNullable()

      // Type et permissions
      table.enum('access_type', ['master', 'limited', 'temporary'])
        .defaultTo('master')


      table.enum('status', ['active', 'revoked', 'lost', 'suspended'])
        .defaultTo('active')

      // Dates de validité (pour badges temporaires)
      table.timestamp('valid_from').nullable()
      table.timestamp('valid_until').nullable()

      // Métadonnées
      table.text('notes').nullable()


      table.integer('issued_by').unsigned().nullable()
        .references('id').inTable('users')


      table.integer('revoked_by').unsigned().nullable()
        .references('id').inTable('users')


      table.timestamp('issued_at').notNullable()
      table.timestamp('revoked_at').nullable()

      // Sync ZKTeco
      table.enum('sync_status', ['pending', 'synced', 'failed'])
        .defaultTo('pending')


      table.integer('synced_doors_count').unsigned().defaultTo(0)


      table.timestamp('last_synced_at').nullable()

      // Audit
      table.integer('created_by').unsigned().nullable()
        .references('id').inTable('users')

      table.integer('last_modified_by').unsigned().nullable()
        .references('id').inTable('users')

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // Index
      table.index(['user_id'])
      table.index(['status'])
      table.index(['access_type'])
      table.index(['card_uid'])
      table.index(['user_id_on_device'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
