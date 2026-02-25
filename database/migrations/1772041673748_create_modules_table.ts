import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'modules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('slug').notNullable().unique() // 'pms', 'pos', 'channel_manager', 'mobile_app'
      table.string('name').notNullable()
      table.decimal('price_monthly', 10, 2).notNullable()
      table.text('description').nullable()
      table.boolean('is_active').defaultTo(true)
      table.boolean('is_bundle').defaultTo(false)
      table.json('included_modules_json').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}