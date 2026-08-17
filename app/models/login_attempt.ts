import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type FailureReason =
  | 'WRONG_PASSWORD'
  | 'ACCOUNT_LOCKED'
  | 'MFA_FAILED'
  | 'EMAIL_NOT_VERIFIED'
  | 'RATE_LIMIT'

export default class LoginAttempt extends BaseModel {
  static table = 'login_attempts'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_id' })
  declare userId: number | null

  @column()
  declare email: string

  @column({ columnName: 'ip_address' })
  declare ipAddress: string

  @column({ columnName: 'user_agent' })
  declare userAgent: string | null

  @column()
  declare success: boolean

  @column({ columnName: 'failure_reason' })
  declare failureReason: FailureReason | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>
}
