import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import EmploymentContract from './employment_contract.js'

export default class Payroll extends BaseModel {
  @column({ isPrimary: true })
  declare payroll_id: number

  @column()
  declare contract_id: number

  @column.date()
  declare month_year: DateTime

  @column()
  declare gross_salary: number

  @column()
  declare normal_hours: number

  @column()
  declare overtime_hours: number

  @column()
  declare overtime_pay: number

  @column()
  declare bonuses: number

  @column()
  declare allowances: number

  @column()
  declare cnps_contributions: number

  @column()
  declare withheld_taxes: number

  @column()
  declare net_salary: number

  @column()
  declare rib_employe: string

  @column()
  declare payslip_file_path: string

  @belongsTo(() => EmploymentContract, { foreignKey: 'contract_id' })
  declare contract: BelongsTo<typeof EmploymentContract>
}
