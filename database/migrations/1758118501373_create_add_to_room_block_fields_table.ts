import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_blocks'

    async up() {
    // First, drop existing columns
    this.schema.alterTable(this.tableName, (table) => {
      table.string('description')
    })

  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {

      table.dropColumn('description')

    })
  }
}
