import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany, beforeCreate, afterCreate, afterUpdate } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import { TransactionType, TransactionCategory, TransactionStatus } from '#app/enums'
import Hotel from './hotel.js'
import Folio from './folio.js'
import PaymentMethod from './payment_method.js'
import User from './user.js'
import Discount from './discount.js'
import Guest from './guest.js'
import ReservationRoom from './reservation_room.js'
import TaxRate from './tax_rate.js'
import ExtraCharge from './extra_charge.js'
import TransactionHook from '../hooks/transaction_hooks.js'

export default class FolioTransaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare folioId: number

  @column()
  declare transactionNumber: number

  @column()
  declare transactionCode: string

  @column()
  declare transactionType: TransactionType

  @column()
  declare category: TransactionCategory

  @column()
  declare subcategory: string

  @column()
  declare description: string

  @column()
  declare particular: string

  @column()
  declare amount: number

  @column()
  declare totalAmount: number

  @column()
  declare balance: number

  @column()
  declare quantity: number

  @column()
  declare unitPrice: number

  @column()
  declare taxAmount: number

  @column()
  declare taxRate: number

  @column()
  declare serviceChargeAmount: number

  @column()
  declare serviceChargeRate: number

  @column()
  declare discountAmount: number

  @column()
  declare discountRate: number

  @column()
  declare netAmount: number

  @column()
  declare grossAmount: number

  @column.dateTime()
  declare transactionDate: DateTime

  @column()
  declare transactionTime: string

  @column.dateTime()
  declare postingDate: DateTime

  @column.dateTime()
  declare serviceDate: DateTime

  @column.date({ columnName: 'current_working_date' })
  declare currentWorkingDate: DateTime | null

  @column()
  declare reference: string

  @column()
  declare externalReference: string

  @column()
  declare invoiceNumber: string

  @column()
  declare receiptNumber: string

  @column()
  declare voucherNumber: string

  @column()
  declare authorizationCode: string

  @column()
  declare paymentMethodId: number

  @column()
  declare paymentReference: string

  @column()
  declare creditCardLast4: string

  @column()
  declare creditCardType: string

  @column()
  declare checkNumber: string

  @column()
  declare bankReference: string

  @column()
  declare cashierId: number

  @column()
  declare terminalId: string

  @column()
  declare workstationId: string

  @column()
  declare shiftId: string

  @column()
  declare departmentCode: string

  @column()
  declare revenueCenter: string

  @column()
  declare costCenter: string

  @column()
  declare accountCode: string

  @column()
  declare glAccount: string

  @column()
  declare projectCode: string

  @column()
  declare budgetCode: string

  @column()
  declare currencyCode: string

  @column()
  declare exchangeRate: number

  @column()
  declare baseCurrencyAmount: number

  @column()
  declare originalAmount: number

  @column()
  declare originalCurrency: string

  @column.date()
  declare exchangeRateDate: DateTime

  @column()
  declare roomNumber: string

  @column()
  declare guestName: string

  @column()
  declare guestId: number

  @column()
  declare reservationId: number | null

  @column({ columnName: 'reservation_room_id' })
  declare reservationRoomId: number | null

  @column()
  declare groupId: number

  @column()
  declare packageId: number

  @column()
  declare ratePlanId: number

  @column()
  declare discountId: number

  // Link to ExtraCharge when this transaction represents an extra charge
  @column({ columnName: 'extra_charge_id' })
  declare extraChargeId: number | null

  @column()
  declare promotionCode: string

  @column()
  declare loyaltyPoints: number

  @column()
  declare loyaltyRedemption: boolean

  @column()
  declare compPoints: number

  @column()
  declare compReason: string

  @column()
  declare complementary: boolean

  @column()
  declare compAuthorizedBy: number

  @column()
  declare isVoided: boolean

  @column()
  declare voidedBy: number

  @column.dateTime()
  declare voidedAt: DateTime

  @column.dateTime()
  declare voidedDate: DateTime | null

  @column()
  declare voidReason: string

  @column()
  declare originalTransactionId: number

  @column()
  declare correctionOf: number

  @column()
  declare correctionReason: string

  @column()
  declare transferredTo: number

  @column()
  declare transferredFrom: number

  @column()
  declare transferReason: string

  @column()
  declare isTransferFromAdvanceDeposit: boolean

  @column()
  declare isRefund: boolean

  @column()
  declare refundReason: string

  @column()
  declare refundAuthorizedBy: number

  @column()
  declare isAdjustment: boolean

  @column()
  declare adjustmentReason: string

  @column()
  declare adjustmentAuthorizedBy: number

  @column()
  declare isManual: boolean

  @column()
  declare isAutoPosted: boolean

  @column()
  declare autoPostRule: string

  @column()
  declare isRecurring: boolean

  @column()
  declare recurringSchedule: object

  @column()
  declare nextRecurringDate: DateTime

  @column()
  declare isTaxable: boolean

  @column()
  declare taxExempt: boolean

  @column()
  declare taxExemptReason: string

  @column()
  declare taxBreakdown: object

  @column()
  declare isCommissionable: boolean

  @column()
  declare commissionRate: number

  @column()
  declare commissionAmount: number

  @column()
  declare isServiceChargeable: boolean

  @column()
  declare serviceChargeExempt: boolean

  @column()
  declare gratuityIncluded: boolean

  @column()
  declare gratuityAmount: number

  @column()
  declare tipAmount: number

  @column()
  declare roundingAdjustment: number

  @column()
  declare businessDate: DateTime

  @column()
  declare auditDate: DateTime

  @column()
  declare fiscalPeriod: string

  @column()
  declare accountingPeriod: string

  @column()
  declare revenueDate: DateTime

  @column()
  declare recognitionDate: DateTime

  @column()
  declare deferredRevenue: boolean

  @column()
  declare deferralPeriod: number

  @column()
  declare notes: string

  @column()
  declare internalNotes: string

   @column({
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare itemSummary: object | null

  @column()
  declare guestNotes: string

  @column()
  declare printOnBill: boolean

  @column()
  declare printDescription: string

  @column()
  declare hideFromGuest: boolean

  @column()
  declare requiresApproval: boolean

  @column()
  declare approvedBy: number

  @column.dateTime()
  declare approvedAt: DateTime

  @column()
  declare status: TransactionStatus

  // Payment assignment fields
  @column()
  declare assignedAmount: number

  @column()
  declare unassignedAmount: number

  @column()
  declare assignmentHistory: object | null

  @column()
  declare voucher: string | null

  @column()
  declare createdBy: number

  @column()
  declare table: string | null

  @column()
  declare lastModifiedBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Folio)
  declare folio: BelongsTo<typeof Folio>

  @belongsTo(() => ReservationRoom, { foreignKey: 'reservationRoomId' })
  declare reservationRoom: BelongsTo<typeof ReservationRoom>

  @belongsTo(() => PaymentMethod)
  declare paymentMethod: BelongsTo<typeof PaymentMethod>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => Guest, { foreignKey: 'guestId' })
  declare guest: BelongsTo<typeof Guest>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'voidedBy' })
  declare voidedByUser: BelongsTo<typeof User>

  @belongsTo(() => Discount)
  declare discount: BelongsTo<typeof Discount>

  // Relation to ExtraCharge
  @belongsTo(() => ExtraCharge, { foreignKey: 'extraChargeId' })
  declare extraCharge: BelongsTo<typeof ExtraCharge>

  @manyToMany(() => TaxRate, {
    pivotTable: 'folio_transaction_taxes',
    localKey: 'id',
    pivotForeignKey: 'folio_transaction_id',
    relatedKey: 'taxRateId',
    pivotRelatedForeignKey: 'tax_rate_id',
    pivotColumns: ['tax_amount', 'tax_rate_percentage', 'taxable_amount']
  })
  declare taxes: ManyToMany<typeof TaxRate>

  // Computed properties
  get isCharge() {
    return this.transactionType === TransactionType.CHARGE
  }

  get isPayment() {
    return this.transactionType === TransactionType.PAYMENT
  }

  get isCredit() {
    return [TransactionType.PAYMENT, TransactionType.REFUND, TransactionType.ADJUSTMENT].includes(this.transactionType) && this.amount < 0
  }

  get isDebit() {
    return [TransactionType.CHARGE, TransactionType.TAX].includes(this.transactionType) && this.amount > 0
  }

  get absoluteAmount() {
    return Math.abs(this.amount)
  }

  get displayAmount() {
    return this.isCredit ? -this.absoluteAmount : this.absoluteAmount
  }

  get isPosted() {
    return this.status === TransactionStatus.POSTED
  }

  get isPending() {
    return this.status === TransactionStatus.PENDING
  }

  get canBeVoided() {
    return this.isPosted && !this.isVoided && this.transactionType !== 'void'
  }

  get canBeRefunded() {
    return this.isPosted && !this.isVoided && this.isCharge && !this.isRefund
  }

  get effectiveAmount() {
    if (this.isVoided) return 0
    return this.netAmount || this.amount
  }

  get taxPercentage() {
    if (this.amount === 0) return 0
    return (this.taxAmount / this.amount) * 100
  }

  get serviceChargePercentage() {
    if (this.amount === 0) return 0
    return (this.serviceChargeAmount / this.amount) * 100
  }

  get discountPercentage() {
    if (this.grossAmount === 0) return 0
    return (this.discountAmount / this.grossAmount) * 100
  }

  get displayName() {
    return `${this.transactionNumber} - ${this.description}`
  }

  get typeColor() {
    const colors:any = {
      [TransactionType.CHARGE]: 'red',
      [TransactionType.PAYMENT]: 'green',
      [TransactionType.ADJUSTMENT]: 'blue',
      'tax': 'orange',
      'discount': 'purple',
      'refund': 'teal',
      'transfer': 'yellow',
      'void': 'gray',
      'correction': 'brown'
    }
    return colors[this.transactionType] || 'gray'
  }

  get statusColor() {
    const colors: any = {
      [TransactionStatus.PENDING]: 'orange',
      [TransactionStatus.POSTED]: 'green',
      [TransactionStatus.VOIDED]: 'red',
      [TransactionStatus.TRANSFERRED]: 'blue',
      [TransactionStatus.DISPUTED]: 'purple',
      [TransactionStatus.REFUNDED]: 'teal',
      [TransactionStatus.WRITE_OFF]: 'brown',
    }
    return colors[this.status] || 'gray'

  }
  // Register the hook
  @beforeCreate()
  public static async beforeCreate(transaction: FolioTransaction) {
    if (transaction.currentWorkingDate || !transaction.hotelId) {
      return
    }

    const hotel = await Hotel.query().where('id', transaction.hotelId).select(['id', 'current_working_date']).first()
    transaction.currentWorkingDate = hotel?.currentWorkingDate ?? DateTime.now()
  }

  @afterCreate()
  public static afterCreate(transaction: FolioTransaction) {
    TransactionHook.checkFolioStatus(transaction)
  }
  @afterUpdate()
  public static afterUpdate(transaction: FolioTransaction) {
    TransactionHook.checkFolioStatus(transaction)
  }
}
