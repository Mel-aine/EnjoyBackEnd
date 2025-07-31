import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payrolls'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('payrollId', 'payroll_id')
      table.renameColumn('contractId', 'contract_id')
      table.renameColumn('monthYear', 'month_year')
      table.renameColumn('grossSalary', 'gross_salary')
      table.renameColumn('normalHours', 'normal_hours')
      table.renameColumn('overtimeHours', 'overtime_hours')
      table.renameColumn('overtimePay', 'overtime_pay')
      table.renameColumn('cnpsContributions', 'cnps_contributions')
      table.renameColumn('withheldTaxes', 'withheld_taxes')
      table.renameColumn('netSalary', 'net_salary')
      table.renameColumn('ribEmploye', 'rib_employe')
      table.renameColumn('payslipFilePath', 'payslip_file_path')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('payroll_id', 'payrollId')
      table.renameColumn('contract_id', 'contractId')
      table.renameColumn('month_year', 'monthYear')
      table.renameColumn('gross_salary', 'grossSalary')
      table.renameColumn('normal_hours', 'normalHours')
      table.renameColumn('overtime_hours', 'overtimeHours')
      table.renameColumn('overtime_pay', 'overtimePay')
      table.renameColumn('cnps_contributions', 'cnpsContributions')
      table.renameColumn('withheld_taxes', 'withheldTaxes')
      table.renameColumn('net_salary', 'netSalary')
      table.renameColumn('rib_employe', 'ribEmploye')
      table.renameColumn('payslip_file_path', 'payslipFilePath')
    })
  }
}
