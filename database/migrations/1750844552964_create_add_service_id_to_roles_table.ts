import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('service_id').unsigned().nullable().references('id').inTable('services').onDelete('CASCADE')
      table.integer('category_id').unsigned().nullable().references('id').inTable('categories').onDelete('CASCADE')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('service_id')
      table.dropColumn('category_id')
    })
  }
}
