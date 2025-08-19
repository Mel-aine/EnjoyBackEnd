import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import User from '#models/user'
import Guest from '#models/guest'


export default class LostAndFoundItem extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare description: string

  @column()
  declare item_category:'Electronics' | 'Jewelry' | 'Clothing' | 'Documents' | 'Bags' | 'Toiletries' | 'Keys' | 'Other' | null

  @column.dateTime()
  declare found_datetime: DateTime

  @column()
  declare found_location: string

  @column()
  declare found_by_user_id: number | null

  @column()
  declare status: 'Found' | 'Claimed' | 'Discarded' | 'Stored' | 'Returned'

  @column.dateTime()
  declare claimed_datetime: DateTime | null

  @column()
  declare claiming_guest_id: number | null

  @column()
  declare return_method: 'Mail' | 'InPersonPickup' | 'CourierService' | 'Other' | null

  @column()
  declare additional_notes: string | null

  @column()
  declare storage_location: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'found_by_user_id' })
  declare foundByUser: BelongsTo<typeof User>

  @belongsTo(() => Guest, { foreignKey: 'claiming_guest_id' })
  declare claimingGuest: BelongsTo<typeof Guest>
}
