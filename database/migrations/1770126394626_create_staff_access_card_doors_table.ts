// database/migrations/XXXX_create_staff_access_card_doors_table.ts

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'staff_access_card_doors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.integer('staff_access_card_id').unsigned().notNullable()
        .references('id').inTable('staff_access_cards').onDelete('CASCADE')

      table.integer('door_id').unsigned().notNullable()
        .references('id').inTable('doors').onDelete('CASCADE')

      table.timestamp('granted_at').nullable()
      table.timestamp('revoked_at').nullable()

      table.enum('sync_status', ['pending', 'synced', 'failed'])
        .defaultTo('pending')

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // Index
      table.unique(['staff_access_card_id', 'door_id'])
      table.index(['door_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
