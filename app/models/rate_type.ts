import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import RoomType from './room_type.js'
import User from './user.js'

export default class RateType extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  @column({ columnName: 'short_code' })
  declare shortCode: string

  @column({ columnName: 'rate_type_name' })
  declare rateTypeName: string

  @column()
  declare nights: number

  @column({ columnName: 'max_adult' })
  declare maxAdult: number

  @column({ columnName: 'min_night' })
  declare minNight: number

  @column({ columnName: 'room_type_id' })
  declare roomTypeId: number | null

  @column()
  declare status: 'active' | 'inactive' | 'draft'

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column({ columnName: 'created_by_user_id' })
  declare createdByUserId: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @column({ columnName: 'updated_by_user_id' })
  declare updatedByUserId: number | null

  @column({ columnName: 'is_deleted' })
  declare isDeleted: boolean

  @column.dateTime({ columnName: 'deleted_at' })
  declare deletedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => RoomType, { foreignKey: 'roomTypeId' })
  declare roomType: BelongsTo<typeof RoomType>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'updatedByUserId' })
  declare updatedByUser: BelongsTo<typeof User>
}