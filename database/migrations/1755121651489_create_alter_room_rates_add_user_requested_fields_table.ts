import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_rates'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add the user-requested fields
      table.integer('rate_type_id').unsigned().nullable()
      table.integer('season_id').unsigned().nullable()
      table.integer('source_id').unsigned().nullable()
      table.dateTime('effective_from').nullable()
      table.dateTime('effective_to').nullable()
      table.timestamp('deleted_at', { useTz: true }).nullable()

      // Add foreign key constraints for new fields
      table.foreign('rate_type_id').references('id').inTable('rate_types').onDelete('SET NULL')
      table.foreign('season_id').references('id').inTable('seasons').onDelete('SET NULL')
      table.foreign('source_id').references('id').inTable('business_sources').onDelete('SET NULL')

      // Add indexes for better performance
      table.index(['rate_type_id'])
      table.index(['season_id'])
      table.index(['source_id'])
      table.index(['effective_from', 'effective_to'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop foreign key constraints first
      table.dropForeign(['rate_type_id'])
      table.dropForeign(['season_id'])
      table.dropForeign(['source_id'])

      // Drop indexes
      table.dropIndex(['rate_type_id'])
      table.dropIndex(['season_id'])
      table.dropIndex(['source_id'])
      table.dropIndex(['effective_from', 'effective_to'])

      // Drop columns
      table.dropColumn('rate_type_id')
      table.dropColumn('season_id')
      table.dropColumn('source_id')
      table.dropColumn('effective_from')
      table.dropColumn('effective_to')
      table.dropColumn('deleted_at')
    })
  }
}
