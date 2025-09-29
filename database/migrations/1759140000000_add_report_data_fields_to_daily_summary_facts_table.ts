import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'daily_summary_facts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('night_audit_report_data').nullable()
      table.json('daily_revenue_report_data').nullable()
      table.json('room_status_report_data').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('night_audit_report_data')
      table.dropColumn('daily_revenue_report_data')
      table.dropColumn('room_status_report_data')
    })
  }
}