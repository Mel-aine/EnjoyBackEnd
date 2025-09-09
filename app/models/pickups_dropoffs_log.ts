
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TransportationMode from './transportation_mode.js'
import Guest from './guest.js'
import Reservation from './reservation.js'
import Folio from './folio.js'
import User from './user.js'

export default class PickupsDropoffsLog extends BaseModel {
  public static table = 'pickups_dropoffs_log'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare guestId: number

  @column()
  declare reservationId?: number

  @column()
  declare transportationModeId: number

  @column.dateTime()
  declare requestDate: DateTime

  @column.dateTime()
  declare scheduledDateTime: DateTime

  @column.dateTime()
  declare actualDateTime?: DateTime

  @column()
  declare serviceType: 'Pickup' | 'Dropoff'

  @column()
  declare locationType: 'Airport' | 'Train Station' | 'Hotel' | 'Local Address'

  @column()
  declare pickupPoint: string

  @column()
  declare dropoffPoint: string

  @column()
  declare flightTrainNumber?: string

  @column()
  declare airlineTrainCompany?: string

  @column()
  declare numberOfPassengers: number

  @column()
  declare numberOfLuggage: number

  @column()
  declare specialRequirements?: string

  @column()
  declare status: 'Pending' | 'Assigned' | 'En Route' | 'Completed' | 'Cancelled'

  @column()
  declare cancellationReason?: string

  @column()
  declare requestedBy: string

  @column()
  declare externalBookingReference?: string

  @column()
  declare externalVehicleMatriculation?: string

  @column()
  declare externalDriverName?: string

  @column()
  declare externalVehicleColor?: string

  @column()
  declare serviceFee?: number

  @column()
  declare chargePostedToFolio: boolean

  @column()
  declare folioId?: number

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy?: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => Guest, { foreignKey: 'guestId' })
  declare guest: BelongsTo<typeof Guest>

  @belongsTo(() => Reservation, { foreignKey: 'reservationId' })
  declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => TransportationMode, { foreignKey: 'transportationModeId' })
  declare transportationMode: BelongsTo<typeof TransportationMode>

  @belongsTo(() => Folio, { foreignKey: 'folioId' })
  declare folio: BelongsTo<typeof Folio>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare lastUpdatedBy: BelongsTo<typeof User>
}
