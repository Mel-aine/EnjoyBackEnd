import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Reservation from '#models/reservation'
import ServiceProduct from '#models/service_product'

export default class ReservationServiceProduct extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare reservation_id: number

  @column()
  declare service_product_id: number

  @column.dateTime()
  declare start_date: DateTime

  @column.dateTime()
  declare end_date: DateTime

  @column.dateTime()
  declare check_in_date: DateTime | null

  @column.dateTime()
  declare check_out_date: DateTime | null

  @column()
  declare status: string | null

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column()
  declare total_adult: number | null

  @column()
  declare total_children: number | null

  @column()
  declare rate_per_night: number | null

  @column()
  declare taxes: number | null

  @column()
  declare extra_guest_price: number | null

  @column()
  declare total_extra_guest_price: number | null

  @column()
  declare total_amount: number | null


  @column()
  declare discounts: number | null

  @column()
  declare extra_guest: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => Reservation, { foreignKey: 'reservation_id' })
  declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => ServiceProduct, { foreignKey: 'service_product_id' })
  declare serviceProduct: BelongsTo<typeof ServiceProduct>

  @belongsTo(() => User, { foreignKey: 'created_by'})
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>
}
