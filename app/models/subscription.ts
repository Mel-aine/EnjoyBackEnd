import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Module from '#models/module'

export default class Subscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare moduleId: number

  @column.dateTime()
  declare startsAt: DateTime

  @column.dateTime()
  declare endsAt: DateTime | null

  @column()
  declare status: 'active' | 'past_due' | 'canceled'

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
}