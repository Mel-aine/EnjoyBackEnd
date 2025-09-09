import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transportation_modes'


 async up() {
    this.schema.alterTable(this.tableName, (table) => {
    table.boolean('is_internal').defaultTo(false)
    table.boolean('is_external').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_internal')
      table.dropColumn('is_external')


    })
  }
}
