// app/models/whatsapp_scheduled_message.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class WhatsappScheduledMessage extends BaseModel {
  static table = 'whatsapp_scheduled_messages'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare reservationId: number | null

  @column()
  declare guestId: number | null

  @column()
  declare templateName: string | null

  @column()
  declare recipientPhone: string | null

  @column()
  declare recipientName: string | null

  @column()
  declare hotelName: string

  @column.dateTime()
  declare sendAfter: DateTime | null

  @column.dateTime()
  declare sentAt: DateTime | null

  @column()
  declare status: 'pending' | 'sent' | 'failed'

  @column()
  declare invoiceUrl: string | null 

  @column()
  declare failureReason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}