import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'daily_summary_facts'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('revenue_by_rate_type').nullable()
      table.json('revenue_by_room_type').nullable()
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('revenue_by_rate_type')
      table.dropColumn('revenue_by_room_type')
    })
  }
}
