import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import Guest from './guest.js'
import PaymentMethod from './payment_method.js'
import User from './user.js'
import FolioTransaction from './folio_transaction.js'

export default class Receipt extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare receiptNumber: string

  @column()
  declare tenantId: number // guestId

  @column()
  declare hotelId: number

  @column.dateTime()
  declare paymentDate: DateTime

  @column()
  declare paymentMethodId: number

  @column()
  declare totalAmount: number

  @column()
  declare description: string

  @column()
  declare breakdown: object // { rent: 1600, tax: 40, discount: -100 }

  @column()
  declare createdBy: number

  @column()
  declare folioTransactionId: number

  @column()
  declare isVoided: boolean

  @column()
  declare voidedBy: number | null

  @column()
  declare currency: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare voidedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Guest, {
    foreignKey: 'tenantId'
  })
  declare tenant: BelongsTo<typeof Guest>

  @belongsTo(() => PaymentMethod)
  declare paymentMethod: BelongsTo<typeof PaymentMethod>

  @belongsTo(() => User, {
    foreignKey: 'createdBy'
  })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'voidedBy'
  })
  declare voider: BelongsTo<typeof User>

  @belongsTo(() => FolioTransaction)
  declare folioTransaction: BelongsTo<typeof FolioTransaction>

  @beforeCreate()
  static async generateReceiptNumber(receipt: Receipt) {
    // Generate receipt number in format: RCP-YYYYMMDD-HHMMSS-XXX
    const now = DateTime.now()
    const dateStr = now.toFormat('yyyyMMdd')
    const timeStr = now.toFormat('HHmmss')
    
    // Get the count of receipts created today for this hotel
    const todayStart = now.startOf('day')
    const todayEnd = now.endOf('day')
    
    const todayCount = await Receipt.query()
      .where('hotel_id', receipt.hotelId)
      .whereBetween('created_at', [todayStart.toJSDate(), todayEnd.toJSDate()])
      .count('* as total')
    
    const sequence = String((todayCount[0].$extras.total || 0) + 1).padStart(3, '0')
    
    receipt.receiptNumber = `RCP-${dateStr}-${timeStr}-${sequence}`
  }
}