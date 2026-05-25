import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'

export default class WhatsappMonthlyStat extends BaseModel {
  static table = 'whatsapp_monthly_stats'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare month: string

  @column()
  declare messageCount: number

  @column()
  declare sessionCount: number

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>
}