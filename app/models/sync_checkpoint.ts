import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class SyncCheckpoint extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare userId: number

  @column()
  declare deviceId: string

  @column()
  declare resourceType: string

  @column.dateTime()
  declare lastSyncAt: DateTime | null

  @column()
  declare lastVersion: bigint | number

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
