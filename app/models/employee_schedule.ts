import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo} from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Employee from '#models/user'

export default class EmployeeSchedule extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare employee_id: number

  @column.date()
  declare schedule_date: DateTime

  @column()
  declare shift_start_time: string

  @column()
  declare shift_end_time: string

  @column()
  declare assigned_task_category?: string | null

  @column()
  declare notes?: string | null

  @column()
  declare is_published: boolean

  @column()
  declare swap_request_status: 'None' | 'Requested' | 'Approved' | 'Rejected'

  @column()
  declare requested_by_employee_id?: number | null

  @column()
  declare created_by: number

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(()=>Employee,{foreignKey:'employee_id'})
  declare employee : BelongsTo<typeof Employee>
}
