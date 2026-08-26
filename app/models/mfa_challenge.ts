import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type MfaChallengeType = 'EMAIL' | 'SMS'

export default class MfaChallenge extends BaseModel {
  static table = 'mfa_challenges'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_id' })
  declare userId: number

  @column({ columnName: 'challenge_id' })
  declare challengeId: string

  @column({ columnName: 'method_type' })
  declare methodType: MfaChallengeType

  @column({ columnName: 'hashed_code' })
  declare hashedCode: string

  @column({ columnName: 'delivered_to' })
  declare deliveredTo: string

  @column()
  declare attempts: number

  @column({ columnName: 'is_consumed' })
  declare isConsumed: boolean

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>
}
