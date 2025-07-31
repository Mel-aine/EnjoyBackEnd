import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ContractStatus } from '../../constants/index.js'

export default class EmploymentContract extends BaseModel {
  @column({ isPrimary: true })
  declare contract_id: number

  @column()
  declare employee_id: number //membre du staff

  @column()
  declare position_id: number

  @column.date()
  declare contract_start_date: DateTime

  @column.date()
  declare contract_end_date?: DateTime

  @column()
  declare base_salary: number

  @column()
  declare is_cdi: number

  @column()
  declare special_conditions?: string

  @column.date()
  declare probation_startDate: DateTime

  @column.date()
  declare probation_end_date: DateTime

  @column()
  declare status: ContractStatus

  @column()
  declare contract_file_path: string

  @belongsTo(() => User, { foreignKey: 'employee_id' })
  declare user: BelongsTo<typeof User>
}
