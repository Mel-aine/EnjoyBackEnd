import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'

export default class EmailAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare title: string

  @column()
  declare emailAddress: string

  @column()
  declare displayName: string

  @column()
  declare signature: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare createdBy: number | null

  @column()
  declare lastModifiedBy: number | null

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>
}