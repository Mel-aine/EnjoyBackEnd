import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop remaining old columns that were missed in previous migration
      table.dropColumn('max_adults')
      table.dropColumn('max_children')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Restore the dropped columns
      table.integer('max_adults').notNullable()
      table.integer('max_children').defaultTo(0)
    })
  }
}