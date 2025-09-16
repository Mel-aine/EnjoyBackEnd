import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dateTime('hold_release_date').nullable()
      table.integer('release_tem').nullable().checkBetween([0, 100])
      table.integer('release_remind_guest_before_days').nullable()
      table.enum('release_remind_guest_before', ['hold_release_date', 'arrival_date']).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('hold_release_date')
      table.dropColumn('release_tem')
      table.dropColumn('release_remind_guest_before_days')
      table.dropColumn('release_remind_guest_before')
    })
  }
}