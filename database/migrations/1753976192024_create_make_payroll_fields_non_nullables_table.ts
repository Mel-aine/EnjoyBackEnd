import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payrolls' // Le nom réel de la table à modifier

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date('month_year').nullable().alter()
      table.decimal('gross_salary', 10, 2).nullable().alter()
      table.integer('normal_hours').nullable().alter()
      table.integer('overtime_hours').nullable().alter()
      table.decimal('overtime_pay', 10, 2).nullable().alter()
      table.decimal('bonuses', 10, 2).nullable().alter()
      table.decimal('allowances', 10, 2).nullable().alter()
      table.decimal('cnps_contributions', 10, 2).nullable().alter()
      table.decimal('withheld_taxes', 10, 2).nullable().alter()
      table.decimal('net_salary', 10, 2).nullable().alter()
      table.string('rib_employe').nullable().alter()
      table.string('payslip_file_path').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date('month_year').notNullable().alter()
      table.decimal('gross_salary', 10, 2).notNullable().alter()
      table.integer('normal_hours').notNullable().alter()
      table.integer('overtime_hours').notNullable().alter()
      table.decimal('overtime_pay', 10, 2).notNullable().alter()
      table.decimal('bonuses', 10, 2).notNullable().alter()
      table.decimal('allowances', 10, 2).notNullable().alter()
      table.decimal('cnps_contributions', 10, 2).notNullable().alter()
      table.decimal('withheld_taxes', 10, 2).notNullable().alter()
      table.decimal('net_salary', 10, 2).notNullable().alter()
      table.string('rib_employe').notNullable().alter()
      table.string('payslip_file_path').notNullable().alter()
    })
  }
}
