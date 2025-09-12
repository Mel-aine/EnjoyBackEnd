import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

    async up() {
    // First, drop existing columns
    this.schema.alterTable(this.tableName, (table) => {
      table.string('language')
    })

  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {

      table.dropColumn('language')

    })
  }
}
