import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { FolioType, FolioStatus, SettlementStatus, WorkflowStatus } from '#app/enums'
import Hotel from './hotel.js'
import Guest from './guest.js'
import FolioTransaction from './folio_transaction.js'
import User from './user.js'
import Reservation from './reservation.js'

export default class Folio extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare guestId: number | null

  @column()
  declare folioNumber: string

  @column()
  declare folioName: string

  @column()
  declare folioType: FolioType

  @column()
  declare reservationId: number | null

  @column()
  declare groupId: number | null

  @column()
  declare companyId: number | null

  @column()
  declare status: FolioStatus

  @column()
  declare settlementStatus: SettlementStatus

  @column()
  declare workflowStatus: WorkflowStatus

  @column.dateTime()
  declare openedDate: DateTime

  @column.dateTime()
  declare closedDate: DateTime | null

  @column.dateTime()
  declare settlementDate: DateTime | null

  @column.dateTime()
  declare finalizedDate: DateTime | null

  @column()
  declare openedBy: number

  @column()
  declare closedBy: number | null

  @column()
  declare totalCharges: number

  @column()
  declare totalPayments: number

  @column()
  declare totalAdjustments: number

  @column()
  declare totalTaxes: number

  @column()
  declare totalServiceCharges: number

  @column()
  declare totalDiscounts: number

  @column()
  declare balance: number

  @column()
  declare creditLimit: number

  @column()
  declare currencyCode: string

  @column()
  declare exchangeRate: number

  @column()
  declare baseCurrencyAmount: number

  @column()
  declare roomCharges: number

  @column()
  declare foodBeverageCharges: number

  @column()
  declare telephoneCharges: number

  @column()
  declare laundryCharges: number

  @column()
  declare minibarCharges: number

  @column()
  declare spaCharges: number

  @column()
  declare businessCenterCharges: number

  @column()
  declare parkingCharges: number

  @column()
  declare internetCharges: number

  @column()
  declare miscellaneousCharges: number

  @column()
  declare packageCharges: number

  @column()
  declare incidentalCharges: number

  @column()
  declare cityTax: number

  @column()
  declare resortFee: number

  @column()
  declare energySurcharge: number

  @column()
  declare serviceFee: number

  @column()
  declare gratuity: number

  @column()
  declare depositAmount: number

  @column()
  declare advancePayment: number

  @column()
  declare refundAmount: number

  @column()
  declare chargebackAmount: number

  @column()
  declare disputedAmount: number

  @column()
  declare writeOffAmount: number

  @column()
  declare transferredAmount: number

  @column()
  declare transferredTo: number

  @column()
  declare transferredFrom: number

  @column.dateTime()
  declare transferredDate: DateTime

  @column()
  declare transferReason: string

  @column()
  declare paymentTerms: string

  @column.dateTime()
  declare dueDate: DateTime

  @column()
  declare billingAddress: object

  @column()
  declare billingContact: object

  @column()
  declare invoiceNumber: string

  @column.dateTime()
  declare invoiceDate: DateTime

  @column()
  declare invoiceSent: boolean

  @column.dateTime()
  declare invoiceSentDate: DateTime

  @column()
  declare paymentInstructions: string

  @column()
  declare specialInstructions: string

  @column()
  declare internalNotes: string

  @column()
  declare guestNotes: string

  @column()
  declare notes: string

  @column({ columnName: 'print_count' })
  declare printCount: number

  @column.dateTime({ columnName: 'last_print_date' })
  declare lastPrintDate: DateTime

  @column()
  declare emailCount: number

  @column.dateTime()
  declare lastEmailDate: DateTime

  @column()
  declare consolidatedBilling: boolean

  @column()
  declare parentFolioId: number

  @column()
  declare splitBilling: boolean

  @column()
  declare splitPercentage: number

  @column()
  declare routingInstructions: object

  @column()
  declare autoPostRules: object

  @column()
  declare creditCardOnFile: boolean

  @column()
  declare creditCardToken: string

  @column()
  declare creditCardLast4: string

  @column()
  declare creditCardExpiry: string

  @column()
  declare creditCardType: string

  @column()
  declare authorizedAmount: number

  @column.dateTime()
  declare authorizationDate: DateTime

  @column()
  declare authorizationCode: string

  @column()
  declare guaranteeType: string

  @column()
  declare guaranteeAmount: number

  @column()
  declare securityDeposit: number

  @column()
  declare incidentalDeposit: number

  @column()
  declare complianceFlags: object

  @column()
  declare taxExempt: boolean

  @column()
  declare taxExemptNumber: string

  @column()
  declare taxExemptReason: string

  @column()
  declare vatNumber: string

  @column()
  declare businessRegistration: string

  @column()
  declare gstinNo: string

  @column()
  declare showTariffOnPrint: boolean

  @column()
  declare postCommissionToTa: boolean

  @column()
  declare generateInvoiceNumber: boolean

  @column()
  declare accountingPeriod: string

  @column()
  declare revenueDate: DateTime

  @column()
  declare postingRestrictions: object

  @column()
  declare auditTrail: object

  // Missing database fields
  @column()
  declare paymentMethod: string | null

  @column()
  declare referenceNumber: string | null

  @column()
  declare billingInstructions: string | null

  @column()
  declare taxId: string | null

  @column()
  declare autoPostRoomCharges: boolean

  @column()
  declare autoPostTax: boolean

  @column()
  declare creditLimitExceeded: boolean

  @column.dateTime()
  declare lastPostedCharge: DateTime | null

  @column()
  declare closingNotes: string | null

  @column()
  declare finalBalance: number | null

  @column()
  declare printed: boolean

  @column.dateTime()
  declare printedDate: DateTime | null

  @column()
  declare printedBy: number | null

  @column()
  declare emailed: boolean

  @column.dateTime()
  declare emailedDate: DateTime | null

  @column()
  declare emailAddress: string | null

  @column()
  declare paymentHistory: object | null

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number

  @column.dateTime()
  declare voidedDate: DateTime | null

  @column()
  declare voidReason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Guest, {
    foreignKey: 'guestId',
  })
  declare guest: BelongsTo<typeof Guest>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => Reservation, {
    foreignKey: 'reservationId',
  })
  declare reservation: BelongsTo<typeof Reservation>

  @hasMany(() => FolioTransaction)
  declare transactions: HasMany<typeof FolioTransaction>

  // Computed properties
  get isOpen() {
    return this.status === 'open'
  }

  get isClosed() {
    return this.status === 'closed'
  }

  get hasBalance() {
    return Math.abs(this.balance) > 0.01
  }

  get isOverdue() {
    return this.dueDate && DateTime.now() > this.dueDate && this.hasBalance
  }

  get daysPastDue() {
    if (!this.isOverdue) return 0
    return Math.floor(DateTime.now().diff(this.dueDate).as('days'))
  }

  get isOverCreditLimit() {
    return this.creditLimit > 0 && this.balance > this.creditLimit
  }

  get availableCredit() {
    if (this.creditLimit <= 0) return null
    return Math.max(0, this.creditLimit - this.balance)
  }

  get netAmount() {
    return this.totalCharges - this.totalPayments - this.totalAdjustments
  }

  get totalRevenue() {
    return this.totalCharges - this.totalDiscounts
  }

  get averageDailyRate() {
    // This would need to be calculated based on room nights
    return this.roomCharges
  }

  get paymentStatus() {
    if (this.balance <= 0) return 'paid'
    if (this.isOverdue) return 'overdue'
    if (this.balance > 0) return 'outstanding'
    return 'unknown'
  }

  get isSettled() {
    return this.settlementStatus === 'settled'
  }

  get isPartiallySettled() {
    return this.settlementStatus === 'partial'
  }

  get isFinalized() {
    return this.workflowStatus === 'finalized'
  }

  get canBeModified() {
    return this.workflowStatus !== 'finalized' && this.status === 'open'
  }

  get requiresSettlement() {
    return this.balance > 0 && this.settlementStatus !== 'settled'
  }

  get displayName() {
    return `${this.folioNumber} - ${this.folioType}`
  }

  get balanceColor() {
    if (this.balance <= 0) return 'green'
    if (this.isOverdue) return 'red'
    if (this.isOverCreditLimit) return 'orange'
    return 'blue'
  }

  get statusColor() {
    const colors = {
      'open': 'blue',
      'closed': 'green',
      'transferred': 'orange',
      'voided': 'red',
      'disputed': 'purple'
    }
    return colors[this.status] || 'gray'
  }
}