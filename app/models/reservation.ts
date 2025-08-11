import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ReservationServiceProduct from '#models/hotel'
import Payment from '#models/hotel'
import Hotel from './hotel.js'
import Guest from './guest.js'
import RoomType from './room_type.js'
import BookingSource from './booking_source.js'
import RatePlan from './rate_plan.js'
import Discount from './discount.js'
import ReservationRoom from './reservation_room.js'
import Folio from './folio.js'
export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export default class Reservation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare guest_id: number

  @column()
  declare primary_room_type_id: number

  @column.date()
  declare scheduled_arrival_date: DateTime

  @column.date()
  declare scheduled_departure_date: DateTime

  @column.dateTime()
  declare actual_arrival_datetime: DateTime | null

  @column.dateTime()
  declare actual_departure_datetime: DateTime | null

  @column()
  declare reservation_status: 'Confirmed' | 'Pending' | 'Cancelled' | 'No-Show' | 'Checked-In' | 'Checked-Out' | 'Waitlist' | 'Modified' | 'PartiallyCheckedIn' | 'Guaranteed'

  @column()
  declare board_basis_type: 'BO' | 'BB' | 'Half Board' | 'Full Board' | 'AllInclusive' | 'Custom' | null

  @column()
  declare num_adults_total: number

  @column()
  declare num_children_total: number

  @column()
  declare booking_source_id: number

  @column()
  declare rate_plan_id: number

  @column()
  declare discount_id: number | null

  @column()
  declare total_estimated_revenue: number

  @column()
  declare special_notes: string | null

  @column()
  declare group_id: number | null

  @column.dateTime()
  declare reservation_datetime: DateTime

  @column()
  declare confirmation_code: string

  @column()
  declare cancellation_reason: string | null

  @column()
  declare no_show_reason: string | null

  @column()
  declare cancellation_fee_amount: number | null

  @column()
  declare estimated_checkin_time: string | null

  @column()
  declare estimated_checkout_time: string | null

  @column()
  declare is_guaranteed: boolean

  @column()
  declare user_id: number

  @column()
  declare service_id: number

  @column()
  declare reservation_type: string

  @column()
  declare reservation_number: string | null

  @column()
  declare guest_count: number | null

  @column()
  declare special_requests: string | null

  @column()
  declare status: string


  @column()
  declare created_by: number | null

  @column.dateTime()
  declare arrived_date?: DateTime

  @column.dateTime()
  declare depart_date?: DateTime

  @column()
  declare reservation_time?: string

  @column()
  declare customer_type: string | null

  @column()
  declare company_name: string | null

  @column()
  declare group_name: string | null

  @column()
  declare number_of_seats: number | null

  @column()
  declare booking_source: string | null

  @column.dateTime()
  declare check_in_date: DateTime | null

  @column.dateTime()
  declare check_out_date: DateTime | null

  @column()
  declare number_of_nights: number | null

  @column()
  declare total_amount?: number

  @column()
  declare discount_amount?: number

  @column()
  declare tax_amount?: number

  @column()
  declare final_amount?: number

  @column()
  declare paid_amount?: number

  @column()
  declare remaining_amount: number | null

  @column()
  declare invoice_available: boolean

  // Enhanced reservation fields
  @column()
  declare hotelId: number

  @column()
  declare guestId: number

  @column()
  declare roomTypeId: number

  @column()
  declare bookingSourceId: number

  @column()
  declare ratePlanId: number

  @column()
  declare discountId: number

  @column()
  declare groupId: number

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

  @column.dateTime()
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

  @column()
  declare payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'disputed' | 'pending'

  @column()
  declare comment?: string

  @column()
  declare last_modified_by: number | null

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

  @hasMany(() => ReservationServiceProduct, {
    foreignKey: 'reservation_id',
  })
  declare reservationServiceProducts: HasMany<typeof ReservationServiceProduct>

  @hasMany(() => Payment, {
    foreignKey: 'reservation_id',
  })
  declare payments: HasMany<typeof Payment>

  // Enhanced relationships
  @belongsTo(() => Hotel,{ foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Guest)
  declare guest: BelongsTo<typeof Guest>

  @belongsTo(() => RoomType)
  declare roomType: BelongsTo<typeof RoomType>

  @belongsTo(() => BookingSource)
  declare bookingSource: BelongsTo<typeof BookingSource>

  @belongsTo(() => RatePlan)
  declare ratePlan: BelongsTo<typeof RatePlan>

  @belongsTo(() => Discount)
  declare discount: BelongsTo<typeof Discount>

  @hasMany(() => ReservationRoom)
  declare reservationRooms: HasMany<typeof ReservationRoom>

  @hasMany(() => Folio)
  declare folios: HasMany<typeof Folio>

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
    return this.payment_status === 'paid'
  }

  get displayName() {
    return `${this.confirmationNumber || this.reservation_number} - ${this.guest?.firstName || 'Guest'}`
  }

}
