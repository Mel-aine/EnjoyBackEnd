import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddTicketCodeAndAssignedTimeToSupportTickets extends BaseSchema {
  protected tableName = 'support_tickets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Code du ticket unique
      table.string('ticket_code').notNullable().unique()
      
      // Temps assigné en minutes
      table.integer('assigned_time').notNullable().defaultTo(0)
      
      // Index pour optimiser les recherches
      table.index(['ticket_code'])
      table.index(['assigned_time'])
      table.index(['status', 'assigned_time'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ticket_code')
      table.dropColumn('assigned_time')
    })
  }
}