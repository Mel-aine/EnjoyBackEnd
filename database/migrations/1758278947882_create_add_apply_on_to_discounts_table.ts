import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddApplyOnToDiscounts extends BaseSchema {
  protected tableName = 'discounts'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('apply_on', ['room_charge', 'extra_charge'])
        .defaultTo('room_charge')
        .notNullable()
        .after('value') // Adds the column after the `value` column
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('apply_on')
    })
  }
}