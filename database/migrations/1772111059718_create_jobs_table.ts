import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('type').notNullable()
      table.jsonb('payload').notNullable()
      table.string('status').defaultTo('pending') // pending, processing, completed, failed
      table.integer('attempts').defaultTo(0)
      table.timestamp('available_at').nullable()
      table.text('last_error').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
