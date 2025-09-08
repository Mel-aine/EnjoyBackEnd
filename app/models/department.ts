import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import ProductService from '#models/products'
import Hotel from '#models/hotel'
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

  @belongsTo(() => User, { foreignKey: 'responsible_user_id' })
  declare responsibleUser: BelongsTo<typeof User>

  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column()
  declare number_employees?: number

  @column()
  declare product_id?: number

  @column()
  declare hotel_id: number

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number



  // Relations
  @column()
  public created_by?: number

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => ProductService, { foreignKey: 'product_id' })
  declare products: HasMany<typeof ProductService>

  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
