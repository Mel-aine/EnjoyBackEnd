import { BaseSchema } from '@adonisjs/lucid/schema'


export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('first_name', 255)
      table.string('last_name', 255)
      table.string('email', 255).notNullable().unique()
      table.string('phone_number', 20)
      table.string('password', 255).notNullable()
      table.integer('role_id').unsigned().references('id').inTable('roles').onDelete('CASCADE')
      table.enu('status', ['active', 'inactive']).defaultTo('active')
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
