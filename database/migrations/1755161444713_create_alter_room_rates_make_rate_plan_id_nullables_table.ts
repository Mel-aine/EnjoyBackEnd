import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_rates'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('rate_plan_id').unsigned().nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('rate_plan_id').unsigned().notNullable().alter()
    })
  }
}