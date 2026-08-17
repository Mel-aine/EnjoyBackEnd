import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'mfa_methods'

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
          .onDelete('CASCADE')
          .notNullable()
          .index()
        table.enu('method_type', ['TOTP', 'EMAIL', 'SMS']).notNullable().index()
        table.boolean('is_default').notNullable().defaultTo(false).index()
        table.text('totp_secret').nullable().comment('Chiffré avec Adonis APP_KEY')
        table.string('phone_number', 50).nullable()
        table.string('label', 255).nullable()
        table.boolean('is_verified').notNullable().defaultTo(false).index()
        table.timestamp('last_used_at', { useTz: true }).nullable()
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
        table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      })

      this.schema.alterTable(this.tableName, (table) => {
        table.unique(['user_id', 'method_type'])
        table.index(['user_id', 'is_verified'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
