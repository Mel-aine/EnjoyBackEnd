import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import RoomType from './room_type.js'
import RatePlan from './rate_plan.js'
import User from './user.js'

export default class RoomRate extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare roomTypeId: number

  @column()
  declare ratePlanId: number

  @column.date()
  declare rateDate: DateTime

  @column()
  declare baseRate: number

  @column()
  declare adultRate: number

  @column()
  declare childRate: number

  @column()
  declare extraPersonRate: number

  @column()
  declare singleOccupancyRate: number

  @column()
  declare doubleOccupancyRate: number

  @column()
  declare tripleOccupancyRate: number

  @column()
  declare weekendRate: number

  @column()
  declare holidayRate: number

  @column()
  declare peakSeasonRate: number

  @column()
  declare offSeasonRate: number

  @column()
  declare minimumNights: number

  @column()
  declare maximumNights: number

  @column()
  declare closedToArrival: boolean

  @column()
  declare closedToDeparture: boolean

  @column()
  declare stopSell: boolean

  @column()
  declare availableRooms: number

  @column()
  declare roomsSold: number

  @column()
  declare occupancyPercentage: number

  @column()
  declare dayType: string

  @column()
  declare isSpecialEvent: boolean

  @column()
  declare specialEventName: string

  @column()
  declare demandMultiplier: number

  @column()
  declare restrictions: object

  @column()
  declare bookingRules: object

  @column()
  declare rateNotes: string

  @column()
  declare isPublished: boolean

  @column()
  declare lastUpdatedBySystem: boolean

  @column()
  declare autoCalculated: boolean

  @column()
  declare calculationSource: string

  @column()
  declare competitorRates: object

  @column()
  declare revenueGenerated: number

  @column()
  declare bookingsCount: number

  @column()
  declare averageDailyRate: number

  @column()
  declare revenuePerAvailableRoom: number

  @column()
  declare status: string

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

  @belongsTo(() => RoomType)
  declare roomType: BelongsTo<typeof RoomType>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => RatePlan)
  declare ratePlan: BelongsTo<typeof RatePlan>

  // Computed properties
  get effectiveRate() {
    if (this.weekendRate && this.isWeekend) return this.weekendRate
    if (this.holidayRate && this.isHoliday) return this.holidayRate
    if (this.peakSeasonRate && this.isPeakSeason) return this.peakSeasonRate
    if (this.offSeasonRate && this.isOffSeason) return this.offSeasonRate
    return this.baseRate
  }

  get isWeekend() {
    return [6, 7].includes(this.rateDate.weekday)
  }

  get isHoliday() {
    return this.dayType === 'holiday'
  }

  get isPeakSeason() {
    return this.dayType === 'peak_season'
  }

  get isOffSeason() {
    return this.dayType === 'off_season'
  }

  get isAvailable() {
    return !this.stopSell && this.availableRooms > 0
  }
}