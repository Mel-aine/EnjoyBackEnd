import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'email_queue'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('email_template_id').unsigned().references('id').inTable('email_templates').onDelete('CASCADE')
      table.string('recipient_email').notNullable()
      table.json('data_context').notNullable()
      table.enum('status', ['pending', 'processing', 'sent', 'failed']).defaultTo('pending')
      table.integer('retry_count').defaultTo(0)
      table.timestamp('last_attempt_at').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}