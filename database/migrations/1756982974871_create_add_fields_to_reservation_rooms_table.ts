import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {

      table.time('check_in_time').nullable()
      table.time('check_out_time').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
   table.time('check_in_time').nullable()
      table.time('check_out_time').nullable()
    })
  }
}
