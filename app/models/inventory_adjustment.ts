
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import InventoryItem from '#models/inventory_item'
import User from '#models/user'

export default class InventoryAdjustment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare item_id: number

  @column()
  declare adjustment_type: string

  @column()
  declare quantity_adjusted: number

  @column.dateTime()
  declare adjustment_datetime: DateTime

  @column()
  declare reason: string | null

  @column()
  declare user_id: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => InventoryItem)
  declare item: BelongsTo<typeof InventoryItem>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
