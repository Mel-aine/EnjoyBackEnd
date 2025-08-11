import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import RoomType from './room_type.js'
import Room from './room.js'
import RatePlan from './rate_plan.js'
import Discount from './discount.js'
import Inventory from './inventory.js'
import User from './user.js'

export default class Hotel extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_name: string

  @column()
  declare hotel_code: string

  @column()
  declare address: string | null

  @column()
  declare city: string | null

  @column()
  declare state_province: string | null

  @column()
  declare country: string | null

  @column()
  declare postal_code: string | null

  @column()
  declare phone_number: string | null

  @column()
  declare email: string | null

  @column()
  declare website: string | null

  @column()
  declare total_rooms: number

  @column()
  declare total_floors: number

  @column()
  declare currency_code: string

  @column()
  declare timezone: string

  @column()
  declare tax_rate: number

  @column()
  declare license_number: string | null

  @column()
  declare status: string

  @column()
  declare amenities: object | null

  @column()
  declare policies: object | null

  @column()
  declare description: string | null

  @column()
  declare logo_url: string | null

  @column()
  declare contact_info: object | null

  @column()
  declare social_media: object | null

  @column()
  declare status_colors: object | null

  @column()
  declare floor_plan_url: string | null

  @column()
  declare fax: string | null

  @column()
  declare system_date_determination_method : 'UseDayClose' | 'RealTime'

  @column()
  declare auto_night_audit_time  : string | null

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @hasMany(() => RoomType)
  declare roomTypes: HasMany<typeof RoomType>

  @hasMany(() => Room)
  declare rooms: HasMany<typeof Room>

  @hasMany(() => RatePlan)
  declare ratePlans: HasMany<typeof RatePlan>

  @hasMany(() => Discount)
  declare discounts: HasMany<typeof Discount>

  @hasMany(() => Inventory)
  declare inventories: HasMany<typeof Inventory>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>
}
