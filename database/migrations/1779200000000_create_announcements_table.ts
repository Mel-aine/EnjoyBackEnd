import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'announcements'

  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.text('title').notNullable()
      table.text('content').notNullable()
      table.enum('type', ['maintenance', 'update', 'info']).nullable()
      table.boolean('is_active').defaultTo(true)
      table.timestamp('starts_at', { useTz: true }).nullable()
      table.timestamp('ends_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.raw(`ALTER TABLE ${this.tableName} ALTER COLUMN id SET DEFAULT gen_random_uuid();`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
