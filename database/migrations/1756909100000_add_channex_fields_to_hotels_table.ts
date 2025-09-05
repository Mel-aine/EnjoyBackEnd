import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('channex_group_id').nullable()
      table.string('channex_property_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('channex_group_id')
      table.dropColumn('channex_property_id')
    })
  }
}