import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ReservationServiceProduct from '#models/hotel'
import Payment from '#models/hotel'
import Hotel from './hotel.js'
import Guest from './guest.js'
import RoomType from './room_type.js'
import BookingSource from './booking_source.js'
import RatePlan from './rate_plan.js'
import Discount from './discount.js'
import BusinessSource from './business_source.js'
import ReservationRoom from './reservation_room.js'
import ReservationGuest from './reservation_guest.js'
import Folio from './folio.js'
import ReservationType from './reservation_type.js'
import PaymentMethod from './payment_method.js'
export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  VOIDED = 'voided',
  NOSHOW = 'no_show',

}

export default class Reservation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

   @column({ columnName: 'complimentary_room' })
  declare complimentaryRoom: boolean

  @column({ columnName: 'guest_id' })
  declare guestId: number

  @column({ columnName: 'primary_room_type_id' })
  declare primaryRoomTypeId: number

  @column.date({ columnName: 'scheduled_arrival_date' })
  declare scheduledArrivalDate: DateTime

  @column.date({ columnName: 'scheduled_departure_date' })
  declare scheduledDepartureDate: DateTime

  @column.dateTime({ columnName: 'actual_arrival_datetime' })
  declare actualArrivalDatetime: DateTime | null

  @column.dateTime({ columnName: 'actual_departure_datetime' })
  declare actualDepartureDatetime: DateTime | null

  @column({ columnName: 'reservation_status' })
  declare reservationStatus: 'Confirmed' | 'Pending' | 'Cancelled' | 'No-Show' | 'Checked-In' | 'Checked-Out' | 'Waitlist' | 'Modified' | 'PartiallyCheckedIn' | 'Guaranteed' | 'partially_no_show'

  @column()
  declare board_basis_type: 'BO' | 'BB' | 'Half Board' | 'Full Board' | 'AllInclusive' | 'Custom' | null

  @column({ columnName: 'num_adults_total' })
  declare numAdultsTotal: number

  @column({ columnName: 'num_children_total' })
  declare numChildrenTotal: number

  @column({ columnName: 'booking_source_id' })
  declare bookingSourceId: number

  @column({ columnName: 'rate_plan_id' })
  declare ratePlanId: number

  @column({ columnName: 'discount_id' })
  declare discountId: number | null

  @column({ columnName: 'total_estimated_revenue' })
  declare totalEstimatedRevenue: number

  @column({ columnName: 'special_notes' })
  declare specialNotes: string | null

  @column({ columnName: 'source_of_business' })
  declare sourceOfBusiness: string | null

  @column({ columnName: 'business_source_id' })
  declare businessSourceId: number | null

  @column({ columnName: 'group_id' })
  declare groupId: number | null

  @column.dateTime({ columnName: 'reservation_datetime' })
  declare reservationDatetime: DateTime

  @column({ columnName: 'confirmation_code' })
  declare confirmationCode: string

  @column({ columnName: 'cancellation_reason' })
  declare cancellationReason: string | null

  @column({ columnName: 'no_show_reason' })
  declare noShowReason: string | null

  @column.dateTime({ columnName: 'no_show_date' })
  declare noShowDate: DateTime | null

  @column({ columnName: 'no_show_fees' })
  declare noShowFees: number | null

  @column({ columnName: 'mark_no_show_by' })
  declare markNoShowBy: number | null

  @column({ columnName: 'cancellation_fee_amount' })
  declare cancellationFeeAmount: number | null

  @column({ columnName: 'estimated_checkin_time' })
  declare estimatedCheckinTime: string | null

  @column({ columnName: 'estimated_checkout_time' })
  declare estimatedCheckoutTime: string | null

  @column({ columnName: 'is_guaranteed' })
  declare isGuaranteed: boolean

  @column({ columnName: 'user_id' })
  declare userId: number

  @column({ columnName: 'service_id' })
  declare serviceId: number | null

  @column({ columnName: 'reservation_type_id' })
  declare reservationTypeId: number | null

  @column({ columnName: 'is_hold' })
  declare isHold: boolean

  @column({ columnName: 'reservation_number' })
  declare reservationNumber: string | null

  @column({ columnName: 'guest_count' })
  declare guestCount: number | null

  @column({ columnName: 'special_requests' })
  declare specialRequests: string | null

  @column({ columnName: 'status' })
  declare status: string

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column.dateTime({ columnName: 'arrived_date' })
  declare arrivedDate?: DateTime

  @column.dateTime({ columnName: 'depart_date' })
  declare departDate?: DateTime

  @column({ columnName: 'reservation_time' })
  declare reservationTime?: string

  @column({ columnName: 'customer_type' })
  declare customerType: string | null

  @column({ columnName: 'company_name' })
  declare companyName: string | null

  @column({ columnName: 'group_name' })
  declare groupName: string | null

  @column({ columnName: 'number_of_seats' })
  declare numberOfSeats: number | null


  @column({ columnName: 'check_in_date' })
  declare checkInDate: DateTime | null

  @column({ columnName: 'check_out_date' })
  declare checkOutDate: DateTime | null

  @column({ columnName: 'number_of_nights' })
  declare numberOfNights: number | null

  @column({ columnName: 'total_amount' })
  declare totalAmount?: number

  @column({ columnName: 'discount_amount' })
  declare discountAmount?: number

  @column({ columnName: 'tax_amount' })
  declare taxAmount?: number

  @column({ columnName: 'final_amount' })
  declare finalAmount?: number

  @column({ columnName: 'paid_amount' })
  declare paidAmount?: number

  @column({ columnName: 'payment_method_id' })
  declare paymentMethodId: number | null

  @column({ columnName: 'remaining_amount' })
  declare remainingAmount?: number

  @column({ columnName: 'invoice_available' })
  declare invoiceAvailable: boolean

  // Enhanced reservation fields

  @column()
  declare roomTypeId: number

  @column()
  declare confirmationNumber: string

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
  declare roomsRequested: number

  @column()
  declare baseRate: number

  @column()
  declare roomRate: number

  @column()
  declare roomCharges: number

  @column()
  declare extraCharges: number

  @column()
  declare serviceCharges: number

  @column()
  declare totalTaxes: number

  @column()
  declare totalDiscounts: number

  @column()
  declare netAmount: number

  @column()
  declare depositRequired: number

  @column()
  declare depositPaid: number

  @column()
  declare balanceDue: number

  @column()
  declare currencyCode: string

  @column()
  declare exchangeRate: number

  @column()
  declare guaranteeType: string

  @column()
  declare creditCardToken: string

  @column()
  declare creditCardLast4: string

  @column()
  declare workflowStatus: string

  @column()
  declare priority: string

  @column()
  declare isGroup: boolean

  @column()
  declare isBlocked: boolean

  @column()
  declare blockReason: string

  @column.dateTime()
  declare blockedAt: DateTime

  @column()
  declare blockedBy: number

  @column.dateTime()
  declare bookingDate: DateTime

  @column.dateTime()
  declare modificationDate: DateTime

  @column()
  declare modifiedBy: number

  @column.dateTime({ columnName: 'cancellation_date' })
  declare cancellationDate: DateTime

  @column()
  declare cancellationFee: number

  @column()
  declare refundAmount: number

  @column()
  declare noShowFee: number

  @column()
  declare marketingSource: string

  @column()
  declare referralSource: string

  @column()
  declare campaignCode: string

  @column()
  declare promoCode: string

  @column()
  declare loyaltyNumber: string

  @column()
  declare corporateCode: string

  @column()
  declare travelAgentCode: string

  @column()
  declare packageCode: string

  @column()
  declare specialOfferCode: string

  @column()
  declare payment_method: number

  @column()
  declare communicationPreferences: object

  @column()
  declare emailConfirmationSent: boolean

  @column()
  declare smsConfirmationSent: boolean

  @column()
  declare remindersSent: object

  @column()
  declare feedbackRequested: boolean

  @column()
  declare reviewInvitationSent: boolean

  @column({ columnName: 'payment_status' })
  declare paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'disputed' | 'pending'

  @column()
  declare comment?: string

  @column({ columnName: 'last_modified_by' })
  declare lastModifiedBy: number | null

  @column({ columnName: 'checked_in_by' })
  declare checkedInBy: number | null

  @column({ columnName: 'checked_out_by' })
  declare checkedOutBy: number | null

  @column({ columnName: 'reserved_by' })
  declare reservedBy: number | null

  @column({ columnName: 'voided_by' })
  declare voidedBy: number | null

  @column.dateTime({ columnName: 'voided_date' })
  declare voidedDate: DateTime | null

  @column({ columnName: 'void_reason' })
  declare voidReason: string | null

  @column({ columnName: 'void_notes' })
  declare voidNotes: string | null

  @column({ columnName: 'tax_exempt' })
  declare taxExempt: boolean

  @column({ columnName: 'tax_exempt_reason' })
  declare taxExemptReason: string | null

  @column.dateTime({ columnName: 'hold_release_date' })
  declare holdReleaseDate: DateTime | null

  @column({ columnName: 'release_tem' })
  declare releaseTem: number | null

  @column({ columnName: 'release_remind_guest_before_days' })
  declare releaseRemindGuestbeforeDays: number | null

  @column({ columnName: 'release_remind_guest_before' })
  declare releaseRemindGuestbefore: 'hold_release_date' | 'arrival_date' | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'checked_in_by' })
  declare checkedInByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'checked_out_by' })
  declare checkedOutByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reserved_by' })
  declare reservedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'voided_by' })
  declare voidedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'mark_no_show_by' })
  declare markNoShowByUser: BelongsTo<typeof User>

  @hasMany(() => ReservationServiceProduct, {
    foreignKey: 'reservation_id',
  })
  declare reservationServiceProducts: HasMany<typeof ReservationServiceProduct>

  @hasMany(() => Payment, {
    foreignKey: 'reservation_id',
  })
  declare payments: HasMany<typeof Payment>

  // Enhanced relationships
  @belongsTo(() => Hotel,{ foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Guest)
  declare guest: BelongsTo<typeof Guest>

  @belongsTo(() => RoomType)
  declare roomType: BelongsTo<typeof RoomType>

  @belongsTo(() => BookingSource)
  declare bookingSource: BelongsTo<typeof BookingSource>

  @belongsTo(() => RatePlan)
  declare ratePlan: BelongsTo<typeof RatePlan>

  @belongsTo(() => ReservationType)
  declare reservationType: BelongsTo<typeof ReservationType>

  @belongsTo(() => Discount)
  declare discount: BelongsTo<typeof Discount>

  @belongsTo(() => BusinessSource)
  declare businessSource: BelongsTo<typeof BusinessSource>

  @belongsTo(() => PaymentMethod)
  declare paymentMethod: BelongsTo<typeof PaymentMethod>

  @hasMany(() => ReservationRoom)
  declare reservationRooms: HasMany<typeof ReservationRoom>

  @hasMany(() => Folio)
  declare folios: HasMany<typeof Folio>

  @hasMany(() => ReservationGuest)
  declare reservationGuests: HasMany<typeof ReservationGuest>

  @manyToMany(() => Guest, {
    pivotTable: 'reservation_guests',
    localKey: 'id',
    pivotForeignKey: 'reservation_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'guest_id',
    pivotColumns: ['is_primary', 'guest_type', 'room_assignment', 'special_requests', 'dietary_restrictions', 'accessibility', 'emergency_contact', 'emergency_phone', 'notes']
  })
  declare guests: ManyToMany<typeof Guest>

  @hasMany(() => Reservation, { foreignKey: 'guest_id' })
declare reservations: HasMany<typeof Reservation>


  // Computed properties
  get totalOccupancy() {
    return (this.adults || 0) + (this.children || 0) + (this.infants || 0)
  }

  get averageRatePerNight() {
    return this.nights > 0 ? (this.roomCharges || 0) / this.nights : 0
  }

  get isConfirmed() {
    return this.status === 'confirmed'
  }

  get isCheckedIn() {
    return this.status === 'checked_in'
  }

  get isCheckedOut() {
    return this.status === 'checked_out'
  }

  get isCancelled() {
    return this.status === 'cancelled'
  }

  get isActive() {
    return ['pending', 'confirmed', 'checked_in'].includes(this.status)
  }

  get hasBalance() {
    return (this.balanceDue || 0) > 0
  }

  get isFullyPaid() {
    return this.paymentStatus === 'paid'
  }

  get displayName() {
    return `${this.confirmationCode} - ${this.guest?.firstName} ${this.guest?.lastName}`
  }

  /**
   * Détermine si la réservation est un dayuse (check-in et check-out le même jour)
   */
  get dayuse(): boolean {
    if (!this.checkInDate || !this.checkOutDate) {
      return false
    }
    
    // Comparer seulement les dates (sans l'heure)
    const checkInDateOnly = this.arrivedDate?.toFormat('yyyy-MM-dd')
    const checkOutDateOnly = this.departDate?.toFormat('yyyy-MM-dd')
    
    return checkInDateOnly === checkOutDateOnly
  }

  /**
   * Calcule la durée en heures pour un dayuse
   */
  get dayuseDuration(): number {
    if (!this.dayuse || !this.checkInTime || !this.checkOutTime) {
      return 0
    }
    
    // Parser les heures au format hh:mm:ss
    const parseTime = (timeStr: string) => {
      const [hours, minutes, seconds] = timeStr.split(':').map(Number)
      return hours + (minutes / 60) + (seconds / 3600)
    }
    
    const checkInHours = parseTime(this.checkInTime)
    const checkOutHours = parseTime(this.checkOutTime)
    
    // Calculer la différence en heures
    let diffInHours = checkOutHours - checkInHours
    
    // Si le checkout est le lendemain (ex: checkin 23:00, checkout 02:00)
    if (diffInHours < 0) {
      diffInHours += 24
    }
    
    // Arrondir à 2 décimales
    return Math.round(diffInHours * 100) / 100
  }

}
