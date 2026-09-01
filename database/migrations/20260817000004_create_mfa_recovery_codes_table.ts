import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'mfa_recovery_codes'

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
        table.string('hashed_code', 255).notNullable().comment('Argon2 hash du recovery code 8 chars')
        table.string('code_hint', 8).notNullable().comment('Ex: ****ABCD (4 derniers chars en clair)')
        table.timestamp('used_at', { useTz: true }).nullable().index()
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now()).index()
      })

      this.schema.alterTable(this.tableName, (table) => {
        table.index(['user_id', 'used_at'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
