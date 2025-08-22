import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Reservation from '#models/reservation'
import User from '#models/user'

export default class CompanyAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare company_name: string

  @column()
  declare company_code: string | null

  @column()
  declare account_type: 'Corporate' | 'TravelAgency' | 'Government' | 'Airline' | 'Other'

  @column()
  declare contact_person_name: string | null

  @column()
  declare contact_person_title: string | null

  @column()
  declare primary_email: string | null

  @column()
  declare secondary_email: string | null

  @column()
  declare primary_phone: string | null

  @column()
  declare secondary_phone: string | null

  @column()
  declare fax_number: string | null

  @column()
  declare website: string | null

  @column()
  declare billing_address_line: string | null

  @column()
  declare billing_address_line2: string | null

  @column()
  declare billing_city: string | null

  @column()
  declare billing_state_province: string | null

  @column()
  declare billing_postal_code: string | null

  @column()
  declare billing_country: string | null

  @column()
  declare tax_id: string | null

  @column()
  declare registration_number: string | null

  @column()
  declare credit_limit: number | null

  @column()
  declare current_balance: number

  @column()
  declare payment_terms: string | null

  @column()
  declare discount_percentage: number | null

  @column()
  declare commission_percentage: number | null

  @column()
  declare account_status: 'Active' | 'Inactive' | 'Suspended' | 'Closed'

  @column()
  declare credit_status: 'Good' | 'Warning' | 'Hold' | 'Blocked'

  @column.dateTime()
  declare last_activity_date: DateTime | null

  @column()
  declare preferred_currency: string | null

  @column()
  declare billing_cycle: 'Weekly' | 'BiWeekly' | 'Monthly' | 'Quarterly' | 'Custom' | null

  @column()
  declare auto_billing_enabled: boolean

  @column()
  declare special_instructions: string | null

  @column()
  declare notes: string | null

  @column()
  declare add_to_business_source: boolean

  @column()
  declare do_not_count_as_city_ledger: boolean

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

  @hasMany(() => Reservation, { foreignKey: 'company_account_id' })
  declare reservations: HasMany<typeof Reservation>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  // Computed properties
  get displayName() {
    return this.company_name
  }

  get isActive() {
    return this.account_status === 'Active'
  }

  get hasGoodCredit() {
    return this.credit_status === 'Good'
  }

  get isCreditLimitExceeded() {
    if (!this.credit_limit) return false
    return this.current_balance > this.credit_limit
  }

  get availableCredit() {
    if (!this.credit_limit) return null
    return Math.max(0, this.credit_limit - this.current_balance)
  }

  get canMakeReservations() {
    return this.isActive && this.hasGoodCredit && !this.isCreditLimitExceeded
  }
}