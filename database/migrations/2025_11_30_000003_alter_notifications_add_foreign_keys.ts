import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  public async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    this.schema.alterTable(this.tableName, (table) => {
      // Add FK for hotel_id → hotels.id
      table
        .integer('hotel_id')
        .unsigned()
        .nullable()
        .alter()
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')

      // Add FK for created_by → users.id
      table
        .integer('created_by')
        .unsigned()
        .nullable()
        .alter()
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')

      // Optional index to speed lookups by template
      table.index(['template_id'])
    })
  }

  public async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['hotel_id'])
      table.dropForeign(['created_by'])
      table.dropIndex(['template_id'])
    })
  }
}

