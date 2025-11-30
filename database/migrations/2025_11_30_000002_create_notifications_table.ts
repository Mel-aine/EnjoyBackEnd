import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    const exists = await this.schema.hasTable(this.tableName)
    if (!exists) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.integer('template_id').unsigned().nullable().references('id').inTable('notification_templates').onDelete('SET NULL')
        table.string('recipient_type', 50).notNullable()
        table.integer('recipient_id').unsigned().notNullable()
        table.string('related_entity_type', 50).nullable()
        table.integer('related_entity_id').unsigned().nullable()
        table.enum('channel', ['EMAIL', 'SMS', 'PUSH', 'IN_APP']).notNullable().defaultTo('IN_APP')
        table.string('subject', 255).notNullable()
        table.text('content').notNullable()
        table.timestamp('sent_at', { useTz: true }).nullable()
        table.enum('status', ['PENDING', 'SENT', 'FAILED', 'DELIVERED']).notNullable().defaultTo('PENDING')
        table.boolean('is_read').notNullable().defaultTo(false)

        table.integer('hotel_id').unsigned().nullable()
        table.integer('created_by').unsigned().nullable()
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
        table.timestamp('updated_at', { useTz: true }).nullable()

        table.index(['recipient_type', 'recipient_id'])
        table.index(['status'])
        table.index(['channel'])
        table.index(['hotel_id'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

