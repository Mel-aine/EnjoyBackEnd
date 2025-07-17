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
  declare policy_id: number

  @column()
  declare service_id: number

  @column()
  declare policy_name: string

  @column()
  declare free_cancellation_periodValue: number

  @column()
  declare free_cancellation_period_unit: 'hours' | 'days'

  @column()
  declare cancellation_fee_type: 'none' | 'fixed' | 'percentage' | 'first_night'

  @column()
  declare cancellation_fee_value: number | null

  @column()
  declare non_refundable_rate_enabled: boolean

  @column()
  declare special_conditions_notes: string | null

   @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare lastModifiedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relationships
  @belongsTo(() => Service, { foreignKey: 'service_id' })
    declare service: BelongsTo<typeof Service>

 @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>
}
