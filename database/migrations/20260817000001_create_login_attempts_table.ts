import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'login_attempts'

  async up() {
    const exists = await this.schema.hasTable(this.tableName)
    if (!exists) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table
          .integer('user_id')
          .unsigned()
          .references('id')
          .inTable('users')
          .onDelete('SET NULL')
          .nullable()
        table.string('email', 255).notNullable().index()
        table.string('ip_address', 45).notNullable().index()
        table.string('user_agent', 512).nullable()
        table.boolean('success').notNullable().defaultTo(false).index()
        table
          .enu('failure_reason', [
            'WRONG_PASSWORD',
            'ACCOUNT_LOCKED',
            'MFA_FAILED',
            'EMAIL_NOT_VERIFIED',
            'RATE_LIMIT',
          ])
          .nullable()
          .index()
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now()).index()
      })

      this.schema.alterTable(this.tableName, (table) => {
        table.index(['email', 'created_at'])
        table.index(['ip_address', 'created_at'])
        table.index(['user_id', 'created_at'])
        table.index(['success', 'created_at'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
