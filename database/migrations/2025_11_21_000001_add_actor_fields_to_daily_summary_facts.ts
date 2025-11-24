import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddActorFieldsToDailySummaryFacts extends BaseSchema {
  protected tableName = 'daily_summary_facts'

  public async up () {
    this.schema.table(this.tableName, (table) => {
      // Nullable to allow backfilling and system-generated facts
      table.integer('created_by_id').unsigned().nullable()
      table.integer('modified_by_id').unsigned().nullable()

      // Optional FKs if users table exists; comment out if not desired
      // table.foreign('created_by_id').references('id').inTable('users').onDelete('SET NULL')
      // table.foreign('modified_by_id').references('id').inTable('users').onDelete('SET NULL')
    })
  }

  public async down () {
    this.schema.table(this.tableName, (table) => {
      // Drop FKs first if they were added
      // table.dropForeign(['created_by_id'])
      // table.dropForeign(['modified_by_id'])
      table.dropColumn('created_by_id')
      table.dropColumn('modified_by_id')
    })
  }
}
