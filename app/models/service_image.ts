import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ServiceProduct from '#models/service_product'

export default class ServiceImage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare service_id: number

  @column()
  declare image_url: string

  @column()
  declare service_product_id: number | null

  @column()
  declare is_primary: boolean

  @column()
  declare caption: string | null

  @column()
  declare created_by: number | null

  @belongsTo(() => ServiceProduct, {
    foreignKey: 'service_product_id',
  })
  declare product: BelongsTo<typeof ServiceProduct>

  @belongsTo(() => User, {
    foreignKey: 'created_by',
  })
  declare creator: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
