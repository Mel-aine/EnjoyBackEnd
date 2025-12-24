import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('hotels', (table) => {
      table.integer('night_audit_start_time').notNullable().defaultTo(1)
      table.integer('night_audit_end_time').notNullable().defaultTo(7)
    })
  }

  async down() {
    this.schema.alterTable('hotels', (table) => {
      table.dropColumn('night_audit_end_time')
      table.dropColumn('night_audit_start_time')
    })
  }
}

