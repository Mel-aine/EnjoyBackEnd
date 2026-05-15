import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'

export default class WhatsappSession extends BaseModel {
  static table = 'whatsapp_sessions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare guestPhone: string

  @column.dateTime()
  declare openedAt: DateTime

  @column.dateTime()
  declare expiresAt: DateTime

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  // Helper : est-ce que cette session est encore valide ?
  get isActive(): boolean {
    return this.expiresAt > DateTime.now()
  }
}