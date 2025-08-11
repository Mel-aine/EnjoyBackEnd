import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Reservation from '#models/reservation'
import Payment from '#models/folio'
import Hotel from '#models/hotel'

export default class Refund extends BaseModel {
  @column({ isPrimary: true })
  declare id: number


  @column()
  declare refund_amount: number

  @column.dateTime()
   declare refund_date: DateTime

  @column()
  declare refund_method: string

  @column()
   declare transaction_reference: string | null

  @column()
  declare reason: string

  @column()
  declare status: string

  @column()
  declare reservation_id: number

  @column()
  declare hotel_id: number

  @column()
  declare payment_id_original: number | null

 @column()
  declare processed_by_user_id: number

   @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations

  @belongsTo(() => Reservation, { foreignKey: 'reservation_id' })
    declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => Payment, {foreignKey: 'payment_id_original'})
  declare payment_original: BelongsTo<typeof Payment>

  @belongsTo(() => User, { foreignKey: 'processed_by_user_id' })
  declare processed_by_user: BelongsTo<typeof User>

  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
    declare hotel: BelongsTo<typeof Hotel>



}
