import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import RoomRate from './room_rate.js'
import User from './user.js'

export default class RatePlan extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare planName: string

  @column()
  declare planCode: string

  @column()
  declare rateType: string

  @column()
  declare description: string

  @column()
  declare calculationMethod: string

  @column()
  declare baseRate: number

  @column.date()
  declare effectiveFrom: DateTime

  @column.date()
  declare effectiveTo: DateTime

  @column()
  declare isActive: boolean

  @column()
  declare minimumNights: number

  @column()
  declare maximumNights: number

  @column()
  declare advanceBookingDays: number

  @column()
  declare applicableDays: object

  @column()
  declare blackoutDates: object

  @column()
  declare bookingSources: object

  @column()
  declare roomTypes: object

  @column()
  declare includedAmenities: object

  @column()
  declare cancellationPolicy: string

  @column()
  declare guaranteeRequired: boolean

  @column()
  declare guaranteeType: string

  @column()
  declare depositRequired: boolean

  @column()
  declare depositAmount: number

  @column()
  declare depositType: string

  @column()
  declare refundable: boolean

  @column()
  declare marketSegments: object

  @column()
  declare guestTypes: object

  @column()
  declare ageRestrictions: object

  @column()
  declare occupancyRestrictions: object

  @column()
  declare packageInclusions: object

  @column()
  declare mealPlan: string

  @column()
  declare currency: string

  @column()
  declare taxInclusive: boolean

  @column()
  declare serviceChargeInclusive: boolean

  @column()
  declare commissionable: boolean

  @column()
  declare commissionRate: number

  @column()
  declare priority: number

  @column()
  declare notes: string

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => RoomRate)
  declare roomRates: HasMany<typeof RoomRate>

  // Computed properties
  get displayName() {
    return `${this.planName} (${this.planCode})`
  }

  get isCurrentlyActive() {
    const now = DateTime.now()
    return this.isActive && 
           (!this.effectiveFrom || now >= this.effectiveFrom) &&
           (!this.effectiveTo || now <= this.effectiveTo)
  }
}