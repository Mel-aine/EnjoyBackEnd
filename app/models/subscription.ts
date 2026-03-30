import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Module from '#models/module'
import AddOn from '#models/add_on'
import InvoiceSubscription from '#models/invoice_subscription'

export default class Subscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare moduleId: number

  @column()
  declare addOnId: number | null

  @column.dateTime()
  declare startsAt: DateTime

  @column.dateTime()
  declare endsAt: DateTime | null

  @column()
  declare status: 'active' | 'past_due' | 'canceled' | 'ended'

  @column()
  declare price: number

  @column()
  declare billingCycle: 'monthly' | 'yearly'

  @column()
  declare paymentStatus: 'paid' | 'pending' | 'failed'

  @column()
  declare limitCount: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Module)
  declare module: BelongsTo<typeof Module>

  @belongsTo(() => AddOn)
  declare addOn: BelongsTo<typeof AddOn>

  @manyToMany(() => InvoiceSubscription, {
    pivotTable: 'invoice_subscription_items',
    pivotForeignKey: 'subscription_id',
    pivotRelatedForeignKey: 'invoice_subscription_id',
    pivotColumns: ['line_amount', 'description', 'period_start', 'period_end'],
  })
  declare invoiceSubscriptions: ManyToMany<typeof InvoiceSubscription>
}
