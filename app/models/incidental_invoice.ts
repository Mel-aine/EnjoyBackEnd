import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Folio from '#models/folio'
import Guest from '#models/guest'
import User from '#models/user'

export default class IncidentalInvoice extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare folioId: number

  @column()
  declare guestId: number

  @column()
  declare invoiceNumber: string

  @column.dateTime()
  declare invoiceDate: DateTime

  @column()
  declare totalAmount: number

  @column()
  declare taxAmount: number

  @column()
  declare serviceChargeAmount: number

  @column()
  declare discountAmount: number

  @column()
  declare netAmount: number

  @column()
  declare currencyCode: string

  @column()
  declare exchangeRate: number

  @column()
  declare baseCurrencyAmount: number

  @column()
  declare paymentMethodId: number | null

  @column()
  declare status: string // 'draft', 'issued', 'paid', 'cancelled', 'voided'

  @column()
  declare type: string // 'Voice Incidence' for this specific use case

  @column()
  declare description: string | null

  @column()
  declare notes: string | null

  @column()
  declare internalNotes: string | null

  @column()
  declare reference: string | null

  @column()
  declare externalReference: string | null

  @column()
  declare billingName: string | null

  @column()
  declare billingAddress: string | null

  @column()
  declare billingCity: string | null

  @column()
  declare billingState: string | null

  @column()
  declare billingZip: string | null

  @column()
  declare billingCountry: string | null

  @column()
  declare emailInvoice: boolean

  @column()
  declare paymentMethod: string | null

  @column()
  declare paymentType: string | null

  @column()
  declare amount: number | null

  @column.dateTime()
  declare dueDate: DateTime | null

  @column.dateTime()
  declare paidDate: DateTime | null

  @column()
  declare paidAmount: number

  @column()
  declare outstandingAmount: number

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
  declare referenceNumber: string | null

  @column()
  declare voidReason: string | null

  @column.dateTime()
  declare voidedDate: DateTime | null

  @column()
  declare voidedBy: number | null

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

  @belongsTo(() => Folio)
  declare folio: BelongsTo<typeof Folio>

  @belongsTo(() => Guest)
  declare guest: BelongsTo<typeof Guest>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'printedBy' })
  declare printer: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'voidedBy' })
  declare voider: BelongsTo<typeof User>

  // Computed properties
  get isPaid() {
    return this.status === 'paid'
  }

  get isOverdue() {
    return this.dueDate && DateTime.now() > this.dueDate && this.outstandingAmount > 0
  }

  get daysPastDue() {
    if (!this.isOverdue) return 0
    return Math.floor(DateTime.now().diff(this.dueDate!).as('days'))
  }

  get isVoided() {
    return this.status === 'voided'
  }

  get isCancelled() {
    return this.status === 'cancelled'
  }

  get canBeModified() {
    return ['draft'].includes(this.status)
  }

  get canBeVoided() {
    return ['issued', 'paid'].includes(this.status)
  }


  // Static method to generate invoice number
  static async generateInvoiceNumber(hotelId: number): Promise<string> {
    const year = DateTime.now().year
    const month = DateTime.now().month.toString().padStart(2, '0')
    
    // Get the last invoice number for this hotel and month
    const lastInvoice = await IncidentalInvoice.query()
      .where('hotelId', hotelId)
      .where('invoiceNumber', 'like', `INC-${year}${month}-%`)
      .orderBy('invoiceNumber', 'desc')
      .first()

    let sequence = 1
    if (lastInvoice) {
      const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0')
      sequence = lastSequence + 1
    }

    return `INC-${year}${month}-${sequence.toString().padStart(4, '0')}`
  }
}