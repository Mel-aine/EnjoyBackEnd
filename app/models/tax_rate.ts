
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'

export default class TaxRate extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare tax_name: string

  @column()
  declare rate_percentage: number

  @column()
  declare is_active: boolean

  @column()
  declare applies_to_room_rate: boolean

  @column()
  declare applies_to_fnb: boolean

  @column()
  declare applies_to_other_services: boolean

  @column.date()
  declare effective_date: DateTime | null

  @column.date()
  declare end_date: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Hotel , {foreignKey : 'hotel_id'})
  declare hotel: BelongsTo<typeof Hotel>
}
