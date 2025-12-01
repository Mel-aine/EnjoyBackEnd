import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('email_verified').notNullable().defaultTo(false)
      table.string('email_verification_token').nullable()
      table.timestamp('email_verification_expires', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('email_verified')
      table.dropColumn('email_verification_token')
      table.dropColumn('email_verification_expires')
    })
  }
}
