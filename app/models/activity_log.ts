import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Hotel from '#models/hotel'

export default class ActivityLog extends BaseModel {
  public static table = 'activity_logs'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_id' })
  declare userId: number | null

  @column()
  declare username: string | null

  @column()
  declare action: string

  @column({ columnName: 'entity_type' })
  declare entityType: string

  @column({ columnName: 'entity_id' })
  declare entityId: number | null

  @column()
  declare description: string | null

  @column({ columnName: 'hotel_id' })
  declare hotelId: number | null

  @column()
  declare changes: Record<string, any> | null

  @column()
  declare meta: Record<string, any> | null

  @column({ columnName: 'ip_address' })
  declare ipAddress: string | null

  @column({ columnName: 'user_agent' })
  declare userAgent: string | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'createdBy',
  })
  declare creator: BelongsTo<typeof User>

   @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
    declare hotel: BelongsTo<typeof Hotel>
}
