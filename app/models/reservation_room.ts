import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Room from './room.js'
import RoomType from './room_type.js'
import User from './user.js'
import Reservation from './reservation.js'
import Guest from './guest.js'
import RoomRate from './room_rate.js'

export default class ReservationRoom extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare reservationId: number

  @column()
  declare roomId: number | null

  @column()
  declare roomTypeId: number

  @column()
  declare guestId: number

  @column()
  declare isOwner: boolean

  @column.date()
  declare checkInDate: DateTime

  @column.date()
  declare checkOutDate: DateTime

  @column()
  declare checkInTime: string

  @column()
  declare checkOutTime: string

  @column()
  declare nights: number

  @column()
  declare adults: number

  @column()
  declare children: number

  @column()
  declare infants: number

  @column()
  declare roomRate: number

  @column()
  declare totalRoomCharges: number

  @column()
  declare roomCharges: number

  @column()
  declare taxAmount: number

  @column()
  declare totalTaxesAmount: number

  @column()
  declare serviceChargeAmount: number

  @column()
  declare discountAmount: number

  @column()
  declare netAmount: number

  @column()
  declare status: 'voided'|'moved_out'|'reserved' | 'checked_in' | 'checked_out' | 'no_show' | 'cancelled' | 'blocked'

  @column()
  declare bedPreference: string

  @column()
  declare smokingPreference: 'smoking' | 'non_smoking' | 'no_preference'

  @column()
  declare floorPreference: string

  @column()
  declare viewPreference: string

  @column()
  declare accessibilityRequirements: object

  @column()
  declare specialRequests: string

  @column()
  declare guestNotes: string

  @column()
  declare internalNotes: string

  @column()
  declare checkInNotes: string

  @column()
  declare checkOutNotes: string

  @column()
  declare housekeepingNotes: string

  @column()
  declare notes: string | null

  @column()
  declare rateAmount: number | null

  @column()
  declare totalAmount: number | null

  @column.dateTime()
  declare actualCheckInTime: DateTime

  @column.dateTime()
  declare actualCheckOutTime: DateTime

  @column()
  declare checkedInBy: number

  @column()
  declare checkedOutBy: number

  @column()
  declare earlyCheckIn: boolean

  @column()
  declare lateCheckOut: boolean

  @column()
  declare earlyCheckInFee: number

  @column()
  declare lateCheckOutFee: number

  @column()
  declare depositAmount: number

  @column()
  declare damageCharges: number

  @column()
  declare minibarCharges: number

  @column()
  declare otherCharges: number

  @column()
  declare totalCharges: number

  @column()
  declare restaurantCharges: number

  @column()
  declare roomServiceCharges: number

  @column()
  declare parkingCharges: number

  @column()
  declare businessCenterCharges: number

  @column()
  declare incidentalCharges: number

  @column()
  declare phoneCharges: number

  @column()
  declare internetCharges: number

  @column()
  declare laundryCharges: number

  @column()
  declare spaCharges: number

  @column()
  declare keyCardsIssued: number

  @column()
  declare keyCardsReturned: number

  @column()
  declare keyCardNumbers: object

  @column()
  declare parkingSpaceAssigned: string

  @column()
  declare wifiCredentials: object

  @column()
  declare safeCode: string

  @column()
  declare minibarSetup: object

  @column()
  declare amenitiesProvided: object

  @column()
  declare welcomeGifts: object

  @column()
  declare turndownService: boolean

  @column()
  declare housekeepingFrequency: string

  @column()
  declare doNotDisturb: boolean

  @column()
  declare doNotDisturbUntil: DateTime

  @column()
  declare wakeUpCall: boolean

  @column()
  declare wakeUpTime: string

  @column()
  declare newspaperDelivery: boolean

  @column()
  declare newspaperType: string

  @column()
  declare roomServiceOrders: object

  @column()
  declare maintenanceIssues: object

  @column()
  declare cleaningStatus: string

  @column()
  declare inspectionStatus: string

  @column()
  declare lastCleanedAt: DateTime

  @column()
  declare lastInspectedAt: DateTime

  @column()
  declare energyManagement: object

  @column()
  declare temperatureSettings: object

  // Meal inclusions
  @column()
  declare breakfastIncluded: boolean

  @column()
  declare lunchIncluded: boolean

  @column()
  declare dinnerIncluded: boolean

  @column()
  declare drinksIncluded: boolean

  // Technology services
  @column()
  declare wifiIncluded: boolean

  @column()
  declare digitalKey: boolean

  @column()
  declare mobileCheckIn: boolean

  // Transportation services
  @column()
  declare parkingIncluded: boolean

  @column()
  declare airportTransferIncluded: boolean

  // Facility access
  @column()
  declare spaAccessIncluded: boolean

  @column()
  declare gymAccessIncluded: boolean

  @column()
  declare poolAccessIncluded: boolean

  @column()
  declare businessCenterIncluded: boolean

  // Hotel services
  @column()
  declare conciergeServiceIncluded: boolean

  @column()
  declare roomServiceIncluded: boolean

  @column()
  declare laundryServiceIncluded: boolean

  @column()
  declare turndownServiceIncluded: boolean

  @column()
  declare dailyHousekeepingIncluded: boolean

  // Guest amenities
  @column()
  declare welcomeGift: boolean

  @column()
  declare roomDecoration: boolean

  // Special amenities
  @column()
  declare champagne: boolean

  @column()
  declare sendMail: boolean

  @column()
  declare checkOutMail: boolean

  @column()
  declare thankYouEmail: boolean

  @column()
  declare supressRate: boolean

  @column()
  declare accessGuestPortal: boolean

  @column()
  declare flowers: boolean

  @column()
  declare chocolates: boolean

  @column()
  declare fruitBasket: boolean

  // Check-in/out options
  @column()
  declare expressCheckOut: boolean

  // Room configurations
  @column()
  declare extraBed: boolean

  @column()
  declare crib: boolean

  @column()
  declare rollawayBed: boolean

  @column()
  declare connectingRooms: boolean

  // Package options
  @column()
  declare packageInclusions: boolean

  @column()
  declare lightingPreferences: object

  @column()
  declare curtainSettings: object

  @column()
  declare tvChannelPreferences: object

  @column()
  declare internetUsage: object

  @column()
  declare phoneCallLogs: object

  @column()
  declare minibarConsumption: object

  @column()
  declare laundryServices: object

  @column()
  declare dryCleaningServices: object

  @column()
  declare conciergeRequests: object

  @column()
  declare transportationArrangements: object

  @column()
  declare restaurantReservations: object

  @column()
  declare spaAppointments: object

  @column()
  declare activityBookings: object

  @column()
  declare businessCenterUsage: object

  @column()
  declare fitnessCenter: object

  @column()
  declare poolAccess: object

  @column()
  declare guestFeedback: object

  @column()
  declare satisfactionRating: number

  @column()
  declare complaints: object

  @column()
  declare compliments: object

  @column()
  declare incidentReports: object

  @column()
  declare securityNotes: object

  @column()
  declare emergencyContacts: object

  @column()
  declare medicalNotes: object

  @column()
  declare allergies: object

  @column()
  declare dietaryRestrictions: object

  @column()
  declare celebrationDetails: object

  @column()
  declare anniversaryDetails: object

  @column()
  declare birthdayDetails: object

  @column()
  declare honeymoonPackage: boolean

  @column()
  declare businessTraveler: boolean

  @column()
  declare groupMember: boolean

  @column()
  declare vipGuest: boolean

  @column()
  declare loyaltyMember: boolean

  @column()
  declare loyaltyTier: string

  @column()
  declare loyaltyPoints: number

  @column()
  declare repeatGuest: boolean

  @column()
  declare previousStays: object

  @column()
  declare guestPreferences: object

  @column()
  declare communicationPreferences: object

  @column()
  declare marketingOptIn: boolean

  @column()
  declare photoPermission: boolean

  @column()
  declare socialMediaSharing: boolean

  @column()
  declare reviewInvitation: boolean

  @column()
  declare followUpSurvey: boolean

  @column()
  declare packageRate: boolean

  @column.dateTime({ columnName: 'voided_date' })
  declare voidedDate: DateTime | null

  @column({ columnName: 'void_reason' })
  declare voidReason: string | null

  @column({ columnName: 'void_notes' })
  declare voidNotes: string | null

  @column()
  declare upsellOpportunities: object

  @column()
  declare crossSellOpportunities: object

  @column()
  declare revenueOptimization: object

  @column()
  declare costOptimization: object

  @column()
  declare operationalEfficiency: object

  @column()
  declare qualityMetrics: object

  @column()
  declare performanceIndicators: object

  @column()
  declare benchmarkComparisons: object

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number

  // Room change tracking
  @column()
  declare roomChangeReason: string

  @column.dateTime()
  declare roomChangedAt: DateTime

  @column()
  declare roomChangedBy: number

  // Room upgrade tracking
  @column()
  declare upgradeReason: string

  @column.dateTime()
  declare upgradedAt: DateTime

  @column()
  declare upgradedBy: number

  @column()
  declare roomRateId: number | null

  // No-show tracking
  @column()
  declare noShowReason: string

  @column.dateTime()
  declare noShowAt: DateTime

  @column()
  declare noShowBy: number

  // Cancellation tracking
  @column()
  declare cancellationReason: string

  @column.dateTime()
  declare cancelledAt: DateTime

  @column()
  declare cancelledBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Room)
  declare room: BelongsTo<typeof Room>

  @belongsTo(() => RoomType)
  declare roomType: BelongsTo<typeof RoomType>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => Reservation, { foreignKey: 'reservationId' })
  declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => Guest, { foreignKey: 'guestId' })
  declare guest: BelongsTo<typeof Guest>


  @belongsTo(() => RoomRate,{ foreignKey : 'roomRateId'})
  declare roomRates: BelongsTo <typeof RoomRate>
  // Computed properties
  get isCheckedIn() {
    return this.status === 'checked_in'
  }

  get isCheckedOut() {
    return this.status === 'checked_out'
  }

  get isActive() {
    return ['reserved', 'checked_in'].includes(this.status)
  }

  get totalOccupancy() {
    return this.adults + this.children + this.infants
  }

  get averageRatePerNight() {
    return this.nights > 0 ? this.totalRoomCharges / this.nights : 0
  }

  get stayDuration() {
    if (!this.actualCheckInTime || !this.actualCheckOutTime) return null
    return this.actualCheckOutTime.diff(this.actualCheckInTime).as('hours')
  }

  get isEarlyCheckIn() {
    return this.earlyCheckIn || (this.actualCheckInTime && this.actualCheckInTime.hour < 15)
  }

  get isLateCheckOut() {
    return this.lateCheckOut || (this.actualCheckOutTime && this.actualCheckOutTime.hour > 12)
  }

  get totalExtraFees() {
    return (this.earlyCheckInFee || 0) + (this.lateCheckOutFee || 0)
  }

  get finalAmount() {
    return this.netAmount + this.totalExtraFees
  }

  get hasSpecialRequests() {
    return !!(this.specialRequests || this.accessibilityRequirements)
  }

  get hasPreferences() {
    return !!(this.bedPreference || this.smokingPreference !== 'no_preference' ||
             this.floorPreference || this.viewPreference)
  }

  get isVip() {
    return this.vipGuest || this.loyaltyTier === 'platinum' || this.loyaltyTier === 'diamond'
  }

  get guestType() {
    if (this.businessTraveler) return 'business'
    if (this.groupMember) return 'group'
    if (this.honeymoonPackage) return 'honeymoon'
    if (this.celebrationDetails) return 'celebration'
    return 'leisure'
  }

  get roomStatusColor() {
    const colors = {
      'reserved': 'blue',
      'checked_in': 'green',
      'checked_out': 'gray',
      'no_show': 'red',
      'cancelled': 'orange',
      'blocked': 'purple',
      "moved_out": 'yellow',
      "moved_in": 'cyan',
      "voided":"black"
    }
    return colors[this.status] || 'gray'
  }

  get satisfactionLevel() {
    if (this.satisfactionRating >= 9) return 'excellent'
    if (this.satisfactionRating >= 7) return 'good'
    if (this.satisfactionRating >= 5) return 'average'
    if (this.satisfactionRating >= 3) return 'poor'
    return 'very_poor'
  }

  get displayName() {
    return `Room ${this.room?.roomNumber || 'TBD'} - ${this.checkInDate.toFormat('MMM dd')} to ${this.checkOutDate.toFormat('MMM dd')}`
  }
}
