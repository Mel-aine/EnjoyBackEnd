
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Hotel from '#models/hotel'

export type LogStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'received'

export default class WhatsappLog extends BaseModel {
  static table = 'whatsapp_logs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare reservationId: number | null

  @column()
  declare metaMessageId: string | null

  @column()
  declare status: LogStatus

  @column()
  declare templateName: string | null

  @column()
  declare recipientPhone: string | null

  @column()
  declare messageBody: string | null

  @column()
  declare provider: string

  @column()
  declare cost: number | null

  @column()
  declare credentialSource: string | null

  @column({ prepare: (v) => JSON.stringify(v) })
  declare providerResponse: Record<string, any> | null

  @column()
  declare failureReason: string | null

  @column.dateTime()
  declare sentAt: DateTime | null

  @column.dateTime()
  declare deliveredAt: DateTime | null

  @column.dateTime()
  declare readAt: DateTime | null

  @column.dateTime()
  declare failedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>
}