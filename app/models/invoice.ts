import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Subscription from './subscription.js'

export default class Invoice extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare amount: number

  @column()
  declare subscriptionId: number | null

  @column()
  declare currency: string

  @column()
  declare status: 'pending' | 'paid' | 'failed' | 'cancelled'

  @column()
  declare invoiceNumber: string

  @column()
  declare description: string | null

  @column.dateTime()
  declare billingDate: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Subscription)
  declare subscription: BelongsTo<typeof Subscription>
}
