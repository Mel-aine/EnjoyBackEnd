import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'mfa_challenges'

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
        table.string('challenge_id', 64).notNullable().unique().index()
        table.enu('method_type', ['EMAIL', 'SMS']).notNullable().index()
        table.string('hashed_code', 255).notNullable().comment('Argon2 hash du code 6 chiffres')
        table.string('delivered_to', 255).notNullable().comment('Email masqué ou n° téléphone')
        table.smallint('attempts').notNullable().defaultTo(0)
        table.boolean('is_consumed').notNullable().defaultTo(false).index()
        table.timestamp('expires_at', { useTz: true }).notNullable().index()
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now()).index()
      })

      this.schema.alterTable(this.tableName, (table) => {
        table.index(['user_id', 'is_consumed', 'expires_at'])
        table.index(['challenge_id', 'is_consumed', 'expires_at'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
