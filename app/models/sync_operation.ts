import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class SyncOperation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare userId: number

  @column()
  declare operationId: string

  @column()
  declare operationType: 'create' | 'update' | 'delete'

  @column()
  declare resourceType: string

  @column()
  declare resourceId: number | null

  @column()
  declare payload: Record<string, any>

  @column()
  declare status: 'pending' | 'processing' | 'completed' | 'conflicted' | 'failed'

  @column()
  declare priority: number

  @column.dateTime()
  declare clientTimestamp: DateTime

  @column.dateTime()
  declare serverTimestamp: DateTime

  @column()
  declare conflictData: Record<string, any> | null

  @column()
  declare errorMessage: string | null

  @column()
  declare retryCount: number

  @column()
  declare maxRetries: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
