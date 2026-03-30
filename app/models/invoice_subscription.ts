import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'
import Subscription from './subscription.js'
import InvoiceSubscriptionReceipt from './invoice_subscription_receipt.js'
import InvoiceSubscriptionPayment from './invoice_subscription_payment.js'

export default class InvoiceSubscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare invoiceNumber: string

  @column()
  declare totalAmount: number

  @column()
  declare currency: string

  @column()
  declare status: 'pending' | 'paid' | 'failed' | 'cancelled'

  @column()
  declare billingFrom: any | null

  @column.dateTime()
  declare billingDate: DateTime

  @column.dateTime()
  declare periodStart: DateTime

  @column.dateTime()
  declare periodEnd: DateTime

  @column.dateTime()
  declare paidAt: DateTime | null

  @column()
  declare createdBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @manyToMany(() => Subscription, {
    pivotTable: 'invoice_subscription_items',
    pivotForeignKey: 'invoice_subscription_id',
    pivotRelatedForeignKey: 'subscription_id',
    pivotColumns: ['line_amount', 'description', 'period_start', 'period_end'],
  })
  declare subscriptions: ManyToMany<typeof Subscription>

  @hasMany(() => InvoiceSubscriptionReceipt)
  declare receipts: HasMany<typeof InvoiceSubscriptionReceipt>

  @hasMany(() => InvoiceSubscriptionPayment)
  declare payments: HasMany<typeof InvoiceSubscriptionPayment>
}
