import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('hotels', (table) => {
      table.date('current_working_date').nullable()
      table.timestamp('last_night_audit_date', { useTz: true }).nullable()
    })

    this.schema.alterTable('folio_transactions', (table) => {
      table.date('current_working_date').nullable()
    })
  }

  async down() {
    this.schema.alterTable('folio_transactions', (table) => {
      table.dropColumn('current_working_date')
    })

    this.schema.alterTable('hotels', (table) => {
      table.dropColumn('last_night_audit_date')
      table.dropColumn('current_working_date')
    })
  }
}

