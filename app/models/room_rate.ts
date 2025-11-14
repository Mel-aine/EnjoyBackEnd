import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, afterSave, beforeDelete } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import RoomType from './room_type.js'
import RatePlan from './rate_plan.js'
import RateType from './rate_type.js'
import Season from './season.js'
import BusinessSource from './business_source.js'
import User from './user.js'
import MealPlan from './meal_plan.js'
import ChannexRatePlanService from '#app/services/channex_rate_plan_service'

export default class RoomRate extends BaseModel {
  private static channexRatePlanService = new ChannexRatePlanService()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare roomTypeId: number

  @column()
  declare rateTypeId: number

  @column()
  declare seasonId: number | null

  @column()
  declare sourceId: number | null

  @column()
  declare ratePlanId: number | null

  @column({ columnName: 'meal_plan_id' })
  declare mealPlanId: number | null

  @column.date()
  declare rateDate: DateTime | null

  @column.date()
  declare effectiveFrom: DateTime | null

  @column.date()
  declare effectiveTo: DateTime | null

  @column()
  declare baseRate: number

  @column()
  declare extraAdultRate: number | null

  @column()
  declare extraChildRate: number | null

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
  declare status: string | null

  @column()
  declare channexRateId: string | null

  @column({ columnName: 'tax_include' })
  declare taxInclude: boolean

  @column({ columnName: 'meal_plan_rate_include' })
  declare mealPlanRateInclude: boolean

  @column()
  declare createdBy: number | null

  @column()
  declare lastModifiedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => RoomType)
  declare roomType: BelongsTo<typeof RoomType>

  @belongsTo(() => RateType)
  declare rateType: BelongsTo<typeof RateType>

  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @belongsTo(() => BusinessSource, { foreignKey: 'sourceId' })
  declare source: BelongsTo<typeof BusinessSource>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => RatePlan)
  declare ratePlan: BelongsTo<typeof RatePlan>

  @belongsTo(() => MealPlan, { foreignKey: 'mealPlanId' })
  declare mealPlan: BelongsTo<typeof MealPlan>

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

  /**
   * Hook: Après la sauvegarde (création ou modification)
   */
  @afterSave()
  static async syncWithChannex(roomRate: RoomRate) {
    // Synchroniser seulement si certains champs critiques changent
    const syncFields = ['baseRate', 'availableRooms', 'stopSell', 'minimumNights', 'maximumNights', 'closedToArrival', 'closedToDeparture']
    
    if (roomRate.$dirty.any(syncFields)) {
      const hotel = await roomRate.related('hotel').query().first()
      
      if (hotel && hotel.channexPropertyId) {

        
        try {
          await this.channexRatePlanService.syncRoomRate(roomRate, hotel.channexPropertyId)
        } catch (error) {
          console.error('Failed to sync room rate with Channex:', error)
        }
      }
    }
  }

  /**
   * Hook: Avant la suppression
   */
  @beforeDelete()
  static async deleteFromChannex(roomRate: RoomRate) {
    const hotel = await roomRate.related('hotel').query().first()
    
    if (hotel && hotel.channexPropertyId && roomRate.channexRateId) {
      
      try {
        await this.channexRatePlanService.deleteRoomRate(roomRate, hotel.channexPropertyId)
      } catch (error) {
        console.error('Failed to delete room rate from Channex:', error)
      }
    }
  }
}
