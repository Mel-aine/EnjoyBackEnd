import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class Currency extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare country: string

  @column()
  declare name: string

  @column()
  declare sign: string

  @column()
  declare prefixSuffix: 'prefix' | 'suffix'

  @column()
  declare currencyCode: string

  @column()
  declare digitsAfterDecimal: number

  @column()
  declare exchangeRate: number

  @column()
  declare isEditable: boolean

  @column()
  declare hotelId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare createdByUserId: number | null

  @column()
  declare updatedByUserId: number | null

  @column()
  declare isDeleted: boolean

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdBy: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'updatedByUserId',
  })
  declare updatedBy: BelongsTo<typeof User>
}