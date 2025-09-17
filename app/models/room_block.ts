import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Room from './room.js'
import User from './user.js'
import Hotel from './hotel.js'
import RoomType from './room_type.js'

export default class RoomBlock extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare roomId: number

  @column()
  declare roomTypeId: number

  @column()
  declare status: 'pending' | 'inProgress' | 'completed'

  @column()
  declare hotelId: number

  @column.date()
  declare blockFromDate: DateTime

  @column.date()
  declare blockToDate: DateTime

  @column()
  declare reason: string | null

  @column()
  declare description: string | null

  @column()
  declare blockedByUserId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // 🔹 Relations
  @belongsTo(() => Room , { foreignKey: 'roomId' })
  declare room: BelongsTo<typeof Room>

  @belongsTo(() => User, { foreignKey: 'blockedByUserId' })
  declare blockedBy: BelongsTo<typeof User>

  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => RoomType, { foreignKey: 'roomTypeId' })
  declare roomType: BelongsTo<typeof RoomType>
}
