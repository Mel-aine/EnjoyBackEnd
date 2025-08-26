import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Make foreign key columns nullable
      table.integer('guest_id').nullable().alter()
      table.integer('reservation_id').nullable().alter()
      table.integer('group_id').nullable().alter()
      table.integer('company_id').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Revert back to non-nullable (be careful with existing data)
      table.integer('guest_id').notNullable().alter()
      table.integer('reservation_id').notNullable().alter()
      table.integer('group_id').notNullable().alter()
      table.integer('company_id').notNullable().alter()
    })
  }
}