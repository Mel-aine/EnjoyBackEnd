import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import ProductService from '#models/products'
import Service from '#models/service'
import User from '#models/user'

export default class Department extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare responsible_user_id?: number

  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column()
  declare number_employees?: number

  @column()
  declare product_id?: number

  @column()
  declare service_id: number


  // Relations
  @column()
  public created_by?: number

  @belongsTo(() => User, {
    foreignKey: 'created_by',
  })
  declare creator?: BelongsTo<typeof User>

  @column()
  declare last_modified_by?: number

  @belongsTo(() => User, {
    foreignKey: 'last_modified_by',
  })
  declare lastModifier?: BelongsTo<typeof User>
  @hasMany(() => ProductService, { foreignKey: 'product_id' })
  declare products: HasMany<typeof ProductService>

  @belongsTo(() => Service, { foreignKey: 'service_id' })
  declare service: BelongsTo<typeof Service>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
