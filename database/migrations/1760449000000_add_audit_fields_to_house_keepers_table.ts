import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'house_keepers'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table
        .integer('updated_by_user_id')
        .unsigned()
        .nullable()
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