import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'lost_and_found_items'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')

      table.text('description').notNullable()

      table
        .enu('item_category', ['Electronics', 'Jewelry', 'Clothing', 'Documents', 'Bags', 'Toiletries', 'Keys', 'Other'])
        .nullable()

      table.timestamp('found_datetime', { useTz: true }).notNullable()
      table.string('found_location', 255).notNullable()

      table.integer('found_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')

      table
        .enu('status', ['Found', 'Claimed', 'Discarded', 'Stored', 'Returned'])
        .notNullable()

      table.timestamp('claimed_datetime', { useTz: true }).nullable()

      table.integer('claiming_guest_id').unsigned().nullable().references('id').inTable('guests').onDelete('SET NULL')

      table
        .enu('return_method', ['Mail', 'InPersonPickup', 'CourierService', 'Other'])
        .nullable()

      table.text('additional_notes').nullable()
      table.string('storage_location', 255).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
