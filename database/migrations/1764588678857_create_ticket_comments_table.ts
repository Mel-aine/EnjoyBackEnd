import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'support_tickets' // Note: Vérifiez bien le nom de votre table (support_tickets vs Support_ticket)

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('comments').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('comments')
    })
  }
}