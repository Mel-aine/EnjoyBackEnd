import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'

export default class Invoice extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare amount: number

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
}