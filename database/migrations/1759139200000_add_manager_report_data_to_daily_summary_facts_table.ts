import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'daily_summary_facts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('manager_report_data').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('manager_report_data')
    })
  }
}