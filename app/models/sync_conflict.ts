import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'
import SyncOperation from './sync_operation.js'

export default class SyncConflict extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare syncOperationId: number | null

  @column()
  declare hotelId: number

  @column()
  declare resourceType: string

  @column()
  declare resourceId: number

  @column()
  declare clientVersion: number

  @column()
  declare serverVersion: number

  @column()
  declare clientData: Record<string, any>

  @column()
  declare serverData: Record<string, any>

  @column()
  declare resolution: 'pending' | 'client_wins' | 'server_wins' | 'merged' | 'manual'

  @column()
  declare resolvedBy: number | null

  @column.dateTime()
  declare resolvedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => SyncOperation, { foreignKey: 'syncOperationId' })
  declare syncOperation: BelongsTo<typeof SyncOperation>

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'resolvedBy' })
  declare resolver: BelongsTo<typeof User>
}
