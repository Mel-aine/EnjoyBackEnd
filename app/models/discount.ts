import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class Discount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare discountName: string

  @column()
  declare discountCode: string

  @column()
  declare discountType: 'percentage' | 'fixed_amount' | 'free_nights' | 'upgrade' | 'package'

  @column()
  declare discountValue: number

  @column()
  declare description: string

  @column.date()
  declare validFrom: DateTime

  @column.date()
  declare validTo: DateTime

  @column()
  declare isActive: boolean

  @column()
  declare minimumNights: number

  @column()
  declare maximumNights: number

  @column()
  declare minimumAmount: number

  @column()
  declare maximumAmount: number

  @column()
  declare advanceBookingDays: number

  @column()
  declare applicableDays: object

  @column()
  declare blackoutDates: object

  @column()
  declare roomTypes: object

  @column()
  declare ratePlans: object

  @column()
  declare bookingSources: object

  @column()
  declare marketSegments: object

  @column()
  declare guestTypes: object

  @column()
  declare membershipRequired: boolean

  @column()
  declare membershipTiers: object

  @column()
  declare ageRestrictions: object

  @column()
  declare occupancyRestrictions: object

  @column()
  declare combinable: boolean

  @column()
  declare combinableWith: object

  @column()
  declare priority: number

  @column()
  declare usageLimit: number

  @column()
  declare usageCount: number

  @column()
  declare perGuestLimit: number

  @column()
  declare requiresApproval: boolean

  @column()
  declare autoApply: boolean

  @column()
  declare promoCode: string

  @column()
  declare publiclyVisible: boolean

  @column()
  declare termsAndConditions: string

  @column()
  declare cancellationPolicy: string

  @column()
  declare refundable: boolean

  @column()
  declare transferable: boolean

  @column()
  declare packageInclusions: object

  @column()
  declare freeNightsCount: number

  @column()
  declare upgradeRoomType: string

  @column()
  declare additionalBenefits: object

  @column()
  declare marketingCampaign: string

  @column()
  declare targetAudience: object

  @column()
  declare distributionChannels: object

  @column()
  declare costCenter: string

  @column()
  declare budgetAllocated: number

  @column()
  declare budgetUsed: number

  @column()
  declare revenueImpact: number

  @column()
  declare conversionRate: number

  @column()
  declare clickThroughRate: number

  @column()
  declare redemptionRate: number

  @column()
  declare averageBookingValue: number

  @column()
  declare totalBookings: number

  @column()
  declare totalRevenue: number

  @column()
  declare notes: string

  @column()
  declare status: 'draft' | 'active' | 'paused' | 'expired' | 'cancelled'

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

  // Computed properties
  get displayName() {
    return `${this.discountName} (${this.discountCode})`
  }

  get isCurrentlyValid() {
    const now = DateTime.now()
    return this.isActive && 
           this.status === 'active' &&
           (!this.validFrom || now >= this.validFrom) &&
           (!this.validTo || now <= this.validTo)
  }

  get isUsageLimitReached() {
    return this.usageLimit > 0 && this.usageCount >= this.usageLimit
  }

  get remainingUsage() {
    if (this.usageLimit <= 0) return null
    return Math.max(0, this.usageLimit - this.usageCount)
  }

  get discountPercentage() {
    return this.discountType === 'percentage' ? this.discountValue : null
  }

  get discountAmount() {
    return this.discountType === 'fixed_amount' ? this.discountValue : null
  }

  get roi() {
    if (this.budgetUsed <= 0) return 0
    return ((this.totalRevenue - this.budgetUsed) / this.budgetUsed) * 100
  }
}