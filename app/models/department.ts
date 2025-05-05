import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import ProductService from '#models/product_service'
import Service from '#models/service'

export default class Department extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare name: string

  @column()
  declare description: string

  @column()
  declare responsible: string

  @column()
  declare status: string

  @column()
  declare number_employees: number

  @column()
  declare product_id: number

  @column()
  declare service_id: number

  // Relations
  @hasMany(() => ProductService, { foreignKey: 'product_id' })
  declare products: HasMany<typeof ProductService>

  @belongsTo(() => Service, { foreignKey: 'service_id' })
  declare service: BelongsTo<typeof Service>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
