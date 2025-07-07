import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Service from '#models/service'
import ServiceProduct from '#models/service_product'

export default class Schedules extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare service_id: number

  @column()
  declare service_product_id: number | null

  @column()
  declare travel_route_id: number | null

  @column()
  declare travel_vehicle_id: number | null

  @column()
  declare driver_user_id: number | null

  @column.dateTime()
  declare departure_datetime: DateTime | null

  @column.dateTime()
  declare arrival_datetime: DateTime | null

  @column()
  declare available_seats: number | null

  @column()
  declare price_per_seat: number | null

  @column()
  declare status: string

  @column()
  declare notes: string | null

   @column()
  declare user_id: number | null

  @column.date()
  declare schedule_date: DateTime | null

  @column.dateTime()
  declare start_time: DateTime | null

  @column.dateTime()
  declare end_time: DateTime | null

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @belongsTo(() => ServiceProduct, { foreignKey: 'service_product_id' })
  declare serviceProduct: BelongsTo<typeof ServiceProduct>

  @belongsTo(() => Service, { foreignKey: 'service_id' })
  declare service: BelongsTo<typeof Service>

  @belongsTo(() => User, { foreignKey: 'driver_user_id' })
  declare driverUserId: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
