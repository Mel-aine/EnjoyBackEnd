import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
 protected tableName = 'users'

 async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('service_id').unsigned().nullable()
        .references('id')
        .inTable('services')
        .onDelete('SET NULL')
    })
  }

   async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['service_id'])
      table.dropColumn('service_id')
    })
  }
}