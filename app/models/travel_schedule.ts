import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Service from '#models/service'
import ServiceProduct from '#models/service_product'

export default class TravelSchedule extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare service_id: number

  @column()
  declare service_product_id: number | null

  @column()
  declare travel_route_id: number

  @column()
  declare travel_vehicle_id: number

  @column()
  declare driver_user_id: number | null

  @column.dateTime()
  declare departure_datetime: DateTime

  @column.dateTime()
  declare arrival_datetime: DateTime

  @column()
  declare available_seats: number

  @column()
  declare price_per_seat: number

  @column()
  declare status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

  @column()
  declare notes: string | null

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

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}