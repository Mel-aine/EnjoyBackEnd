import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

    async up() {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer('created_by').nullable().unsigned().alter()
        table.integer('last_modified_by').nullable().unsigned().alter()
      })
    }

    async down() {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer('created_by').notNullable().unsigned().alter()
        table.integer('last_modified_by').notNullable().unsigned().alter()
      })
    }
  }
