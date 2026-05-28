// app/models/guest_feedback.ts
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Hotel from '#models/hotel'
import Reservation from '#models/reservation'
import Guest from '#models/guest'



export default class GuestFeedback extends BaseModel {
  static table = 'guest_feedbacks'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare reservationId: number | null

  @column()
  declare guestId: number | null

  @column()
  declare phoneNumber: string

  @column()
  declare rating: 'excellent' | 'satisfaisant' | 'a_ameliorer'

  @column()
  declare comment: string | null

  @column()
  declare surveyWaMessageId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Reservation)
  declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => Guest)
  declare guest: BelongsTo<typeof Guest>
}