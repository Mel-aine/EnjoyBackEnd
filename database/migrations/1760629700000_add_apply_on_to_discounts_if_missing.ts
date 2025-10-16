import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddApplyOnToDiscountsIfMissing extends BaseSchema {
  protected tableName = 'discounts'

  public async up() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'apply_on')
    if (!hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        table
          .enu('apply_on', ['room_charge', 'extra_charge'])
          .notNullable()
          .defaultTo('room_charge')
      })
    }
  }

  public async down() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'apply_on')
    if (hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('apply_on')
      })
    }
  }
}