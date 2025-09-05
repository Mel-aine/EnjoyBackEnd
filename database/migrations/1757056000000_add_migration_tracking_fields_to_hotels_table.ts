import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('migrated').defaultTo(false).notNullable()
      table.boolean('channel_enable').defaultTo(false).notNullable()
      table.timestamp('last_migration_date').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('migrated')
      table.dropColumn('channel_enable')
      table.dropColumn('last_migration_date')
    })
  }
}