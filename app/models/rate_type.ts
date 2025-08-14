import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'
import RoomType from './room_type.js'

export default class RateType extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  @column({ columnName: 'short_code' })
  declare shortCode: string

  @column({ columnName: 'rate_type_name' })
  declare rateTypeName: string

  @column({ columnName: 'is_package' })
  declare isPackage: boolean | null

  @manyToMany(() => RoomType, {
    pivotTable: 'rate_type_room_types',
    localKey: 'id',
    pivotForeignKey: 'rate_type_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'room_type_id'
  })
  declare roomTypes: ManyToMany<typeof RoomType>

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



  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'updatedByUserId' })
  declare updatedByUser: BelongsTo<typeof User>
}