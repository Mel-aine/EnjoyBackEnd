import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.string('username', 255).nullable()
      table.string('action', 100).notNullable()
      table.string('entity_type', 100).notNullable()
      table.bigInteger('entity_id').nullable()
      table.text('description').nullable()
      table.jsonb('changes').nullable()
      table.string('ip_address', 45).nullable()
      table.text('user_agent').nullable()
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}