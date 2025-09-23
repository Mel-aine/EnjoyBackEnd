import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'lost_found'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)

    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Date fields
      table.string('lost_on').nullable()
      table.string('found_on').nullable()

      // Location fields
      table.string('found_location').nullable()
      table.string('lost_location').nullable()
      table.string('current_location').nullable()

      // Item details
      table.string('item_name').notNullable()
      table.string('item_color').notNullable()
      table.string('item_value').notNullable() // Using string to handle both number and string values

      // Room relationship
      table.integer('room_id').unsigned().notNullable()

      // Complainant information
      table.string('complainant_name').notNullable()
      table.string('phone').notNullable()
      table.string('address').notNullable()
      table.string('city').notNullable()
      table.string('state').notNullable()
      table.string('country').notNullable()
      table.string('zip_code').notNullable()

      // Status and additional info
      table.string('status').notNullable()
      table.text('additional_notes').notNullable()
      table.string('who_found').nullable()

      // Audit fields
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // Foreign key constraint
      table.foreign('room_id').references('id').inTable('rooms').onDelete('CASCADE')

      // Indexes
      table.index(['room_id'])
      table.index(['status'])
      table.index(['lost_on'])
      table.index(['found_on'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
