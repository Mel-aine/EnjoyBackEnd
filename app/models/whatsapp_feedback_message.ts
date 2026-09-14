import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Reservation from './reservation.js'
import Hotel from './hotel.js'
import Guest from './guest.js'


export default class WhatsappFeedbackMessage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number


  @column()
  declare hotelId: number

  @column()
  declare reservationId: number

  @column()
  declare guestName: string

  @column()
  declare guestId: number | null

  @column()
  declare guestPhone: string

  @column.dateTime()
  declare scheduledAt: DateTime

  @column()
  declare status: 'pending' | 'sent' | 'cancelled'

  @column.dateTime()
  declare sentAt: DateTime | null

  @column()
  declare sentBy: number | null

  @belongsTo(() => Reservation)
  declare reservation: BelongsTo<typeof Reservation>

   @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Guest)
  declare guest: BelongsTo<typeof Guest>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
