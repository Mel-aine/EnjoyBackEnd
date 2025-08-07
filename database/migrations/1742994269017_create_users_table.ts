import { BaseSchema } from '@adonisjs/lucid/schema'


export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('first_name', 255)
      table.string('last_name', 255)
      table.string('email', 255).notNullable()
      table.string('phone_number', 20)
      table.string('address', 255).nullable()
      table.text('nationality').nullable()
      table.dateTime('last_login').nullable()
      table.boolean('two_factor_enabled').defaultTo('false')
      table.string('password', 255).nullable()
      table.integer('role_id').unsigned().references('id').inTable('roles').onDelete('CASCADE')
      table.enu('status', ['active', 'inactive', 'suspended']).defaultTo('active')
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      // table.integer('service_id').unsigned().references('id').inTable('services').onDelete('SET NULL').nullable()
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
