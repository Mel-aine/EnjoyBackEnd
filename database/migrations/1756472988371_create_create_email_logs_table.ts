import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'email_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('email_queue_id').unsigned().references('id').inTable('email_queue').onDelete('CASCADE')
      table.timestamp('sent_at').notNullable()
      table.boolean('success').notNullable()
      table.text('response_message').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}