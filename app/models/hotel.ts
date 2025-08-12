import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import RoomType from './room_type.js'
import Room from './room.js'
import RatePlan from './rate_plan.js'
import Discount from './discount.js'
import Inventory from './inventory.js'
import User from './user.js'
import Currency from './currency.js'

export default class Hotel extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_name' })
  declare hotelName: string

  @column({ columnName: 'hotel_code' })
  declare hotelCode: string

  @column()
  declare address: string | null

  @column()
  declare city: string | null

  @column({ columnName: 'state_province' })
  declare stateProvince: string | null

  @column()
  declare country: string | null

  @column({ columnName: 'postal_code' })
  declare postalCode: string | null

  @column({ columnName: 'phone_number' })
  declare phoneNumber: string | null

  @column()
  declare email: string | null

  @column()
  declare website: string | null

  @column({ columnName: 'total_rooms' })
  declare totalRooms: number

  @column({ columnName: 'total_floors' })
  declare totalFloors: number

  @column({ columnName: 'currency_code' })
  declare currencyCode: string

  @column()
  declare timezone: string

  @column({ columnName: 'tax_rate' })
  declare taxRate: number

  @column({ columnName: 'license_number' })
  declare licenseNumber: string | null

  @column()
  declare status: string

  @column()
  declare amenities: object | null

  @column()
  declare policies: object | null

  @column()
  declare description: string | null

  @column({ columnName: 'logo_url' })
  declare logoUrl: string | null

  @column({ columnName: 'contact_info' })
  declare contactInfo: object | null

  @column({ columnName: 'social_media' })
  declare socialMedia: object | null

  @column({ columnName: 'status_colors' })
  declare statusColors: object | null

  @column({ columnName: 'floor_plan_url' })
  declare floorPlanUrl: string | null

  @column()
  declare fax: string | null

  @column({ columnName: 'system_date_determination_method' })
  declare systemDateDeterminationMethod : 'UseDayClose' | 'RealTime'

  @column({ columnName: 'auto_night_audit_time' })
  declare autoNightAuditTime  : string | null

  @column({ columnName: 'registration_no_1' })
  declare registrationNo1: string | null

  @column({ columnName: 'registration_no_2' })
  declare registrationNo2: string | null

  @column({ columnName: 'registration_no_3' })
  declare registrationNo3: string | null

  @column({ columnName: 'cancellation_policy' })
  declare cancellationPolicy: string | null

  @column({ columnName: 'hotel_policy' })
  declare hotelPolicy: string | null

  @column({ columnName: 'property_type' })
  declare propertyType: string | null

  @column({ columnName: 'address_2' })
  declare address2: string | null

  @column()
  declare grade: number | null

  @column()
  declare notices: object | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column({ columnName: 'last_modified_by' })
  declare lastModifiedBy: number | null

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

  @hasMany(() => Currency)
  declare currencies: HasMany<typeof Currency>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>
}
