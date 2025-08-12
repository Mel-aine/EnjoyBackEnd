import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import User from '#models/user'

export default class CompetitorRate extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare hotel_id: number

  @column()
  declare competitor_name: string

  @column()
  declare room_type_description: string

  @column.date()
  declare rate_date: DateTime

  @column()
  declare observed_rate: number

  @column.dateTime()
  declare crawl_datetime: DateTime

  @column()
  declare booking_channel_observed: 'CompetitorWebsite' | 'Booking.com' | 'Expedia' | 'Agoda' | 'OtherOTA' | 'Metasearch'

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>
}
