import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tax_rates'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add audit user foreign keys, nullable by default
      table.integer('created_by_user_id').unsigned().nullable().defaultTo(null)
      table.integer('updated_by_user_id').unsigned().nullable().defaultTo(null)

      table
        .foreign('created_by_user_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table
        .foreign('updated_by_user_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.index(['created_by_user_id'])
      table.index(['updated_by_user_id'])
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['created_by_user_id'])
      table.dropIndex(['updated_by_user_id'])
      table.dropForeign(['created_by_user_id'])
      table.dropForeign(['updated_by_user_id'])
      table.dropColumn('created_by_user_id')
      table.dropColumn('updated_by_user_id')
    })
  }
}