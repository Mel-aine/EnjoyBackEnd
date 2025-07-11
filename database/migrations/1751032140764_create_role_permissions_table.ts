import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'role_permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('role_id')
        .unsigned()
        .references('id')
        .inTable('roles')
        .onDelete('CASCADE')
        .nullable()

      table
        .integer('permission_id')
        .unsigned()
        .references('id')
        .inTable('permissions')
        .onDelete('CASCADE')
        .nullable()
      table.integer('service_id').unsigned().references('id').inTable('services').onDelete('CASCADE').nullable()
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      table.unique(['role_id', 'permission_id']) // éviter les doublons

    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
