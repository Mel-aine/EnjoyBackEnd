import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Reservation from '#models/reservation'

export default class SeatAssignment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare reservation_id: number

  @column()
  declare seat_number: string

  @belongsTo(() => Reservation, { foreignKey: 'ireservation_id' })
  declare reservation: BelongsTo<typeof Reservation>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}