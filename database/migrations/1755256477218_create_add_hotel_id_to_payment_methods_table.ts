import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_methods'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hotel_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
        table.integer('hotel_id').nullable()
    })
  }
}
