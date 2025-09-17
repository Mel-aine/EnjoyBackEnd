import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_owners'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Personal Information
      table.string('name').notNullable()
      table.string('business_name').nullable()
      table.text('address').nullable()
      table.string('country').nullable()
      table.string('state').nullable()
      table.string('city').nullable()
      table.string('zip').nullable()
      table.string('phone').nullable()
      table.string('fax').nullable()
      table.string('mobile').nullable()
      table.string('email').nullable()

      // Commission Information
      table.enum('commission_plan', ['percentage_all_nights', 'fixed_per_night', 'fixed_per_stay']).nullable()
      table.decimal('commission_value', 10, 2).nullable()
      table.enum('rate_type', ['regular', 'special', 'allocated']).nullable()
      table.enum('room_inventory_type', ['regular', 'allocated']).nullable()
      table.decimal('opening_balance', 15, 2).defaultTo(0)

      // User Creation Flag
      table.boolean('create_user').defaultTo(false)

      // Audit Fields
      table.dateTime('created_at').notNullable()
      table.integer('created_by_user_id').unsigned().nullable()
      table.dateTime('updated_at').notNullable()
      table.integer('updated_by_user_id').unsigned().nullable()
      table.boolean('is_deleted').defaultTo(false)
      table.dateTime('deleted_at').nullable()

      // Foreign Key Constraints
      table.foreign('created_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('updated_by_user_id').references('id').inTable('users').onDelete('SET NULL')

      // Indexes
      table.index(['name'])
      table.index(['email'])
      table.index(['is_deleted'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}