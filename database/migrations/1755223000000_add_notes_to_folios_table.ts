import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add notes column
      table.text('notes').nullable().after('guest_notes')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the notes column
      table.dropColumn('notes')
    })
  }
}