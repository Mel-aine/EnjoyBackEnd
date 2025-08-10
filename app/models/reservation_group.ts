import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Reservation from '#models/reservation'
import User from '#models/user'

export default class ReservationGroup extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare group_name: string

  @column()
  declare group_code: string | null

  @column()
  declare group_type: 'Corporate' | 'Tour' | 'Wedding' | 'Conference' | 'Convention' | 'Sports' | 'Other'

  @column()
  declare contact_person_name: string

  @column()
  declare contact_person_email: string | null

  @column()
  declare contact_person_phone: string | null

  @column()
  declare company_organization: string | null

  @column.date()
  declare arrival_date: DateTime

  @column.date()
  declare departure_date: DateTime

  @column()
  declare total_rooms_requested: number

  @column()
  declare total_guests: number

  @column()
  declare adults_count: number

  @column()
  declare children_count: number

  @column()
  declare group_rate: number | null

  @column()
  declare currency_code: string

  @column()
  declare special_requests: string | null

  @column()
  declare catering_requirements: string | null

  @column()
  declare meeting_room_requirements: string | null

  @column()
  declare transportation_needs: string | null

  @column()
  declare billing_instructions: string | null

  @column()
  declare payment_terms: string | null

  @column()
  declare group_status: 'Inquiry' | 'Tentative' | 'Confirmed' | 'Cancelled' | 'CheckedIn' | 'CheckedOut' | 'Completed'

  @column()
  declare contract_signed: boolean

  @column.dateTime()
  declare contract_signed_date: DateTime | null

  @column()
  declare deposit_required: number | null

  @column()
  declare deposit_paid: number | null

  @column.dateTime()
  declare deposit_due_date: DateTime | null

  @column()
  declare cancellation_policy: string | null

  @column.dateTime()
  declare cancellation_deadline: DateTime | null

  @column()
  declare notes: string | null

  @column()
  declare created_by: number

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @hasMany(() => Reservation, { foreignKey: 'group_id' })
  declare reservations: HasMany<typeof Reservation>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  // Computed properties
  get displayName() {
    return this.group_name
  }

  get isActive() {
    return ['Inquiry', 'Tentative', 'Confirmed', 'CheckedIn'].includes(this.group_status)
  }

  get totalNights() {
    return this.departure_date.diff(this.arrival_date, 'days').days
  }

  get hasOutstandingDeposit() {
    if (!this.deposit_required) return false
    const paidAmount = this.deposit_paid || 0
    return paidAmount < this.deposit_required
  }

  get isDepositOverdue() {
    if (!this.deposit_due_date || !this.hasOutstandingDeposit) return false
    return DateTime.now() > this.deposit_due_date
  }
}