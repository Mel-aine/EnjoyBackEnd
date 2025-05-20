import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Service from '#models/service'
import ServiceProduct from '#models/service_product'

export default class TravelVehicle extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare service_id: number

  @column()
  declare service_product_id?: number

  @column()
  declare vehicle_type: 'bus' | 'minibus' | 'car' | 'van' | 'motorcycle' | 'other'

  @column()
  declare brand: string | null

  @column()
  declare model: string | null

  @column()
  declare year: number | null

  @column()
  declare registration_number: string

  @column()
  declare capacity: number

  @column()
  declare features: string[] | null

  @column.date()
  declare last_maintenance_date: DateTime | null

  @column.date()
  declare next_maintenance_date: DateTime | null

  @column()
  declare status: 'available' | 'in_use' | 'maintenance' | 'out_of_order'

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

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}