import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    // Check if column exists before adding it
    const hasColumn = await this.schema.hasColumn(this.tableName, 'checked_in_by')
    
    if (!hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer('checked_in_by').unsigned().nullable()
        table.foreign('checked_in_by').references('id').inTable('users').onDelete('SET NULL')
      })
    }
  }

  async down() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'checked_in_by')
    
    if (hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropForeign(['checked_in_by'])
        table.dropColumn('checked_in_by')
      })
    }
  }
}