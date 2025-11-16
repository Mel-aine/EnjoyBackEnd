import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'password_reset_tokens'

  async up() {
    const exists = await this.schema.hasTable(this.tableName)
    if (!exists) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable()
        table.string('token', 255).notNullable().unique()
        table.timestamp('expires_at', { useTz: true }).notNullable()
        table.timestamp('used_at', { useTz: true }).nullable()
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      })
      this.schema.alterTable(this.tableName, (table) => {
        table.index(['user_id', 'expires_at'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}