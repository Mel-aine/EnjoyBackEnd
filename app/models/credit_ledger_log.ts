import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Guest from './guest.js'
import Reservation from './reservation.js'
import User from './user.js'
import FolioTransaction from './folio_transaction.js'

export default class CreditLedgerLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number


  @column()
  declare guestId: number

  @column()
  declare hotelId: number

  @column()
  declare amount: number

  @column()
  declare movementType: string

  @column()
  declare originType: string

  @column()
  declare originReservationId: number

  @column()
  declare destinationReservationId: number

  @column()
  declare folioTransactionId: number

  @column()
  declare notes: string

  @column()
  declare createdBy: number

  @belongsTo(() => Guest,{foreignKey:'guestId'})
  declare guest: BelongsTo<typeof Guest>

  @belongsTo(() => Reservation,{foreignKey:'originReservationId'})
  declare originReservation: BelongsTo<typeof Reservation>

  @belongsTo(() => Reservation,{foreignKey:'destinationReservationId'})
  declare destinationReservation: BelongsTo<typeof Reservation>

  @belongsTo(() => User,{foreignKey:'createdBy'})
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => FolioTransaction,{foreignKey:'folioTransactionId'})
  declare folioTransaction: BelongsTo<typeof FolioTransaction>


  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}