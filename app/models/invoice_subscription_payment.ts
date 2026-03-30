import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import InvoiceSubscription from './invoice_subscription.js'
import Hotel from './hotel.js'
import User from './user.js'

export default class InvoiceSubscriptionPayment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare invoiceSubscriptionId: number

  @column()
  declare hotelId: number

  @column()
  declare amount: number

  @column()
  declare currency: string

  @column.dateTime()
  declare paymentDate: DateTime

  @column()
  declare paymentMethod: string | null

  @column()
  declare transactionReference: string | null

  @column()
  declare notes: string | null

  @column()
  declare createdBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => InvoiceSubscription)
  declare invoiceSubscription: BelongsTo<typeof InvoiceSubscription>

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>
}

