import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class Discount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare shortCode: string

  @column()
  declare name: string

  @column()
  declare type: 'percentage' | 'flat'

  @column()
  declare openDiscount: boolean

  @column()
  declare value: number

  @column()
  declare applyOn: 'room_charge' | 'extra_charge'

  @column()
  declare status: 'active' | 'inactive'

  // Audit fields
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column()
  declare createdByUserId: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare updatedByUserId: number | null

  @column()
  declare isDeleted: boolean

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'updatedByUserId' })
  declare modifier: BelongsTo<typeof User>
}