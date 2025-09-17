import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_owner_assignments'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Foreign Keys
      table.integer('room_owner_id').unsigned().notNullable()
      table.integer('room_id').unsigned().notNullable()

      // Audit Fields
      table.dateTime('created_at').notNullable()
      table.integer('created_by_user_id').unsigned().nullable()
      table.dateTime('updated_at').notNullable()
      table.integer('updated_by_user_id').unsigned().nullable()
      table.boolean('is_deleted').defaultTo(false)
      table.dateTime('deleted_at').nullable()

      // Foreign Key Constraints
      table.foreign('room_owner_id').references('id').inTable('room_owners').onDelete('CASCADE')
      table.foreign('room_id').references('id').inTable('rooms').onDelete('CASCADE')
      table.foreign('created_by_user_id').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('updated_by_user_id').references('id').inTable('users').onDelete('SET NULL')

      // Unique constraint to prevent duplicate assignments
      table.unique(['room_owner_id', 'room_id'])

      // Indexes
      table.index(['room_owner_id'])
      table.index(['room_id'])
      table.index(['is_deleted'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}