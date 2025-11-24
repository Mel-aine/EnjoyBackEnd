import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddTicketCodeAndAssignedTimeToSupportTickets extends BaseSchema {
  protected tableName = 'support_tickets'

  async up() {
    // 1) Add columns with IF NOT EXISTS to handle prior partial runs
    await this.schema.raw(`ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS assigned_time integer NOT NULL DEFAULT 0`)
    await this.schema.raw(`ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS ticket_code varchar(255)`)

    // Helpful indexes (idempotent)
    await this.schema.raw(`CREATE INDEX IF NOT EXISTS ${this.tableName}_assigned_time_idx ON ${this.tableName}(assigned_time)`)
    await this.schema.raw(`CREATE INDEX IF NOT EXISTS ${this.tableName}_status_assigned_time_idx ON ${this.tableName}(status, assigned_time)`)

    // 2) Backfill ticket codes for existing rows
    await this.schema.raw(`UPDATE ${this.tableName} SET ticket_code = 'TCK-' || id WHERE ticket_code IS NULL`)

    // 3) Enforce NOT NULL and UNIQUENESS after data is consistent
    await this.schema.raw(`ALTER TABLE ${this.tableName} ALTER COLUMN ticket_code SET NOT NULL`)
    await this.schema.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ${this.tableName}_ticket_code_unique ON ${this.tableName}(ticket_code)`)
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ticket_code')
      table.dropColumn('assigned_time')
    })
  }
}
