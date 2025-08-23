import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Reservation from '#models/reservation'
import User from '#models/user'

export default class CompanyAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  @column({ columnName: 'company_name' })
  declare companyName: string

  @column({ columnName: 'company_code' })
  declare companyCode: string | null

  @column({ columnName: 'account_type' })
  declare accountType: 'Corporate' | 'TravelAgency' | 'Government' | 'Airline' | 'Other'

  @column({ columnName: 'contact_person_name' })
  declare contactPersonName: string | null

  @column({ columnName: 'contact_person_title' })
  declare contactPersonTitle: string | null

  @column({ columnName: 'primary_email' })
  declare primaryEmail: string | null

  @column({ columnName: 'secondary_email' })
  declare secondaryEmail: string | null

  @column({ columnName: 'primary_phone' })
  declare primaryPhone: string | null

  @column({ columnName: 'secondary_phone' })
  declare secondaryPhone: string | null

  @column({ columnName: 'fax_number' })
  declare faxNumber: string | null

  @column({ columnName: 'website' })
  declare website: string | null

  @column({ columnName: 'billing_address_line' })
  declare billingAddressLine: string | null

  @column({ columnName: 'billing_address_line2' })
  declare billingAddressLine2: string | null

  @column({ columnName: 'billing_city' })
  declare billingCity: string | null

  @column({ columnName: 'billing_state_province' })
  declare billingStateProvince: string | null

  @column({ columnName: 'billing_postal_code' })
  declare billingPostalCode: string | null

  @column({ columnName: 'billing_country' })
  declare billingCountry: string | null

  @column({ columnName: 'tax_id' })
  declare taxId: string | null

  @column({ columnName: 'registration_number' })
  declare registrationNumber: string | null

  @column({ columnName: 'credit_limit' })
  declare creditLimit: number | null

  @column({ columnName: 'current_balance' })
  declare currentBalance: number

  @column({ columnName: 'payment_terms' })
  declare paymentTerms: string | null

  @column({ columnName: 'discount_percentage' })
  declare discountPercentage: number | null

  @column({ columnName: 'commission_percentage' })
  declare commissionPercentage: number | null

  @column({ columnName: 'account_status' })
  declare accountStatus: 'Active' | 'Inactive' | 'Suspended' | 'Closed'

  @column({ columnName: 'credit_status' })
  declare creditStatus: 'Good' | 'Warning' | 'Hold' | 'Blocked'

  @column.dateTime({columnName:'last_activity_date'})
  declare lastActivityDate: DateTime | null

  @column({ columnName: 'preferred_currency' })
  declare preferredCurrency: string | null

  @column({ columnName: 'billing_cycle' })
  declare billingCycle: 'Weekly' | 'BiWeekly' | 'Monthly' | 'Quarterly' | 'Custom' | null

  @column({ columnName: 'auto_billing_enabled' })
  declare autoBillingEnabled: boolean

  @column({ columnName: 'special_instructions' })
  declare specialInstructions: string | null

  @column()
  declare notes: string | null

  @column({columnName:'add_to_business_source'})
  declare addToBusinessSource: boolean

  @column({columnName:'do_not_count_as_city_ledger'})
  declare doNotCountAsCityLedger: boolean

  @column({ columnName: 'created_by' })
  declare createdBy: number

  @column({ columnName: 'last_modified_by' })
  declare lastModifiedBy: number | null

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
    return this.companyName
  }

  get isActive() {
    return this.accountStatus === 'Active'
  }

  get hasGoodCredit() {
    return this.creditStatus === 'Good'
  }

  get isCreditLimitExceeded() {
    if (!this.creditLimit) return false
    return this.currentBalance > this.creditLimit
  }

  get availableCredit() {
    if (!this.creditLimit) return null
    return Math.max(0, this.creditLimit - this.currentBalance)
  }

  get canMakeReservations() {
    return this.isActive && this.hasGoodCredit && !this.isCreditLimitExceeded
  }
}