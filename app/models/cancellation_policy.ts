import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Service from '#models/service'
import User from '#models/user'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class CancellationPolicy extends BaseModel {
  /**
   * The database table name. AdonisJS automatically maps
   * camelCase model property names to snake_case column names.
   * e.g., `policyId` maps to `policy_id`
   */
  public static table = 'cancellation_policies'

  @column({ isPrimary: true })
  declare policyId: number

  @column()
  declare hotelId: number

  @column()
  declare policyName: string

  @column()
  declare freeCancellationPeriodValue: number

  @column()
  declare freeCancellationPeriodUnit: 'hours' | 'days'

  @column()
  declare cancellationFeeType: 'none' | 'fixed' | 'percentage' | 'first_night'

  @column()
  declare cancellationFeeValue: number | null

  @column()
  declare nonRefundableRateEnabled: boolean

  @column()
  declare specialConditionsNotes: string | null

  @column()
  declare lastModifiedByUserId: number

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare lastModifiedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relationships
  @belongsTo(() => Service, {
    foreignKey: 'hotelId',
  })
  declare hotel: BelongsTo<typeof Service>

  @belongsTo(() => User, {
    foreignKey: 'lastModifiedByUserId',
  })
  declare lastModifiedByUser: BelongsTo<typeof User>
}