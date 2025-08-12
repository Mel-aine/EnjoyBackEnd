
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Employee from '#models/employee'
import User from '#models/user'

export default class TimeClockEntry extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare employee_id: number

  @column.dateTime()
  declare clock_in_datetime: DateTime

  @column.dateTime()
  declare clock_out_datetime: DateTime | null

  @column.dateTime()
  declare break_start_datetime: DateTime | null

  @column.dateTime()
  declare break_end_datetime: DateTime | null

  @column()
  declare total_hours_worked: number | null

  @column()
  declare is_validated: boolean

  @column()
  declare validated_by_user_id: number | null

  @column.dateTime()
  declare validation_datetime: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Employee)
  declare employee: BelongsTo<typeof Employee>

  @belongsTo(() => User, { foreignKey: 'validated_by_user_id' })
  declare validatedBy: BelongsTo<typeof User>
}
