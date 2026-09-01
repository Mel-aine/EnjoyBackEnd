import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeSave } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type MfaMethodType = 'TOTP' | 'EMAIL' | 'SMS'

export default class MfaMethod extends BaseModel {
  static table = 'mfa_methods'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_id' })
  declare userId: number

  @column({ columnName: 'method_type' })
  declare methodType: MfaMethodType

  @column({ columnName: 'is_default' })
  declare isDefault: boolean

  @column({ columnName: 'totp_secret' })
  declare totpSecret: string | null

  @column({ columnName: 'phone_number' })
  declare phoneNumber: string | null

  @column()
  declare label: string | null

  @column({ columnName: 'is_verified' })
  declare isVerified: boolean

  @column.dateTime({ columnName: 'last_used_at' })
  declare lastUsedAt: DateTime | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>
}
