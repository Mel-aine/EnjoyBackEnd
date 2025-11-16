import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ip_configurations'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE').notNullable()
        table.string('ip_address', 100).notNullable()
        table.string('ip_request_from', 255).notNullable()
        table.text('description').nullable()
        table.integer('created_by_user_id').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
        table.integer('updated_by_user_id').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
        table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      })
      this.schema.alterTable(this.tableName, (table) => {
        table.index(['hotel_id', 'ip_address'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}