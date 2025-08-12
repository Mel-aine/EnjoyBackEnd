import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class Season extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  @column({ columnName: 'short_code' })
  declare shortCode: string

  @column({ columnName: 'season_name' })
  declare seasonName: string

  @column({ columnName: 'from_day' })
  declare fromDay: number

  @column({ columnName: 'from_month' })
  declare fromMonth: number

  @column({ columnName: 'to_day' })
  declare toDay: number

  @column({ columnName: 'to_month' })
  declare toMonth: number

  @column.date({ columnName: 'start_date' })
  declare startDate: DateTime

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
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId'
  })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'updatedByUserId'
  })
  declare updatedByUser: BelongsTo<typeof User>
}