import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('default_price',10,2)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('default_price')
    })
  }
}
