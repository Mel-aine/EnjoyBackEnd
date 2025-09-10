import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('business_source_id').unsigned().nullable()
      table.foreign('business_source_id').references('id').inTable('business_sources').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['business_source_id'])
      table.dropColumn('business_source_id')
    })
  }
}