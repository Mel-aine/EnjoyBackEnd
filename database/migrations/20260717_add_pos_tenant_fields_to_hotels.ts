import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('pos_tenant_id', 255).nullable()
      table.string('pos_token_key', 500).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('pos_tenant_id')
      table.dropColumn('pos_token_key')
    })
  }
}
