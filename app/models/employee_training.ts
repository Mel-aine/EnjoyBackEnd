
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Employee from '#models/employee'

export default class  extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare employee_id: number

  @column()
  declare training_name: string

  @column()
  declare training_provider: string | null

  @column.date()
  declare completion_date: DateTime

  @column.date()
  declare certification_valid_until: DateTime | null

  @column()
  declare training_cost: number

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Employee ,{foreignKey : 'employee_id'})
  declare employee: BelongsTo<typeof Employee>
}
