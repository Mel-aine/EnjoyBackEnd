import { DateTime } from 'luxon'
import { BaseModel, column,belongsTo } from '@adonisjs/lucid/orm'
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

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => Reservation, { foreignKey: 'id' })
  declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => ServiceProduct, { foreignKey: 'id' })
  declare serviceProduct: BelongsTo<typeof ServiceProduct>

  @belongsTo(() => User, { foreignKey: 'created_by'})
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>
}
