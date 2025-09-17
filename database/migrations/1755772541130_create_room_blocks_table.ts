import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_blocks'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('room_id').unsigned().notNullable().references('id').inTable('rooms').onDelete('CASCADE')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')

      table.date('block_from_date').notNullable()
      table.date('block_to_date').notNullable()

      table.text('reason').nullable()
      table.integer('room_type_id').unsigned().notNullable().references('id').inTable('room_types').onDelete('CASCADE')
      table.enum('status', ['pending', 'inProgess', 'completed']).defaultTo('pending')

      table.integer('blocked_by_user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      // 🔹 Indexes pour optimiser les requêtes
      table.index(['room_id'])
      table.index(['block_from_date'])
      table.index(['block_to_date'])


    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
