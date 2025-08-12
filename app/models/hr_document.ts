
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Employee from '#models/employee'
import User from '#models/user'

export default class HRDocument extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare employee_id: number

  @column()
  declare document_type: string | null

  @column()
  declare document_name: string

  @column()
  declare file_url: string

  @column.dateTime()
  declare upload_datetime: DateTime

  @column()
  declare uploaded_by_user_id: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Employee)
  declare employee: BelongsTo<typeof Employee>

  @belongsTo(() => User, { foreignKey: 'uploaded_by_user_id' })
  declare uploaded_by: BelongsTo<typeof User>
}
