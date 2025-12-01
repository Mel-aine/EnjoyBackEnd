import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notification_templates'

  async up() {
    const exists = await this.schema.hasTable(this.tableName)
    if (!exists) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.string('code', 100).notNullable().unique()
        table.enum('channel', ['EMAIL', 'SMS', 'PUSH', 'IN_APP']).notNullable().defaultTo('IN_APP')
        table.string('locale', 10).notNullable().defaultTo('en')
        table.string('subject_template', 255).notNullable()
        table.text('content_template').notNullable()
        table.boolean('is_active').notNullable().defaultTo(true)

        table.integer('created_by').unsigned().nullable()
        table.integer('updated_by').unsigned().nullable()
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
        table.timestamp('updated_at', { useTz: true }).nullable()

        table.index(['code'])
        table.index(['channel'])
        table.index(['locale'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

