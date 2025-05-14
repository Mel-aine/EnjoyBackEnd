import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name', 255).notNullable()
      table.text('description')
      table.integer('category_id').unsigned().references('id').inTable('categories').onDelete('CASCADE')
      table.string('address', 255)
      table.string('phone_number', 20)
      table.string('email_service', 255)
      table.string('website', 255)
      table.text('openings')
      table.string('price_range', 50)
      table.text('facilities')
      table.text('policies')
      table.integer('capacity')
      table.text('payment_methods')
      table.string('logo').nullable()
      table.json('images').nullable()
      table.enu('status', ['active', 'inactive','suspended']).defaultTo('active')
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
