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
  declare hotelName: string

  @column()
  declare hotelCode: string

  @column()
  declare address: string

  @column()
  declare city: string

  @column()
  declare stateProvince: string

  @column()
  declare country: string

  @column()
  declare postalCode: string

  @column()
  declare phoneNumber: string

  @column()
  declare email: string

  @column()
  declare website: string

  @column()
  declare totalRooms: number

  @column()
  declare totalFloors: number

  @column()
  declare currencyCode: string

  @column()
  declare timezone: string

  @column()
  declare taxRate: number

  @column()
  declare licenseNumber: string

  @column()
  declare status: string

  @column()
  declare amenities: object

  @column()
  declare policies: object

  @column()
  declare description: string

  @column()
  declare logoUrl: string

  @column()
  declare contactInfo: object

  @column()
  declare socialMedia: object

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number

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

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>
}