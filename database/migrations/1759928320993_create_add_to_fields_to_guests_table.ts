import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'guests'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('vip_status_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('vip_statuses')
        .onDelete('SET NULL')


    })


  }

  async down() {

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('vip_status_id')
    })
  }
}
