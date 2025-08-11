
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Employee from '#models/employee'
import User from '#models/user'

export default class PerformanceReview extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare employee_id: number

  @column()
  declare reviewer_user_id: number

  @column.date()
  declare review_date: DateTime

  @column.date()
  declare review_period_start: DateTime | null

  @column.date()
  declare review_period_end: DateTime | null

  @column()
  declare overall_rating: number | null

  @column()
  declare strengths: string | null

  @column()
  declare areas_for_improvement: string | null

  @column()
  declare goals_for_next_period: string | null

  @column()
  declare employee_comments: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Employee)
  declare employee: BelongsTo<typeof Employee>

  @belongsTo(() => User, { foreignKey: 'reviewer_user_id' })
  declare reviewer: BelongsTo<typeof User>
}
