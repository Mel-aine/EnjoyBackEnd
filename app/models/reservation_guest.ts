import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Reservation from './reservation.js'
import Guest from './guest.js'

export default class ReservationGuest extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare reservationId: number

  @column()
  declare guestId: number | null

  @column()
  declare isPrimary: boolean

  @column()
  declare guestType: 'adult' | 'child' | 'infant'

  @column()
  declare roomAssignment: number | null

  @column()
  declare specialRequests: string | null

  @column()
  declare dietaryRestrictions: string | null

  @column()
  declare accessibility: string | null

  @column()
  declare emergencyContact: string | null

  @column()
  declare emergencyPhone: string | null

  @column()
  declare notes: string | null

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Reservation)
  declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => Guest)
  declare guest: BelongsTo<typeof Guest>
}
