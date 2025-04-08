import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo,hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo,HasMany } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import ProductOption from '#models/production_option'
import User from '#models/user'

export default class ServiceProduct extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare service_id: number

  @column()
  declare product_name: string

  @column()
  declare product_type: string

  @column()
  declare price: number

  @column()
  declare description: string

  @column()
  declare availability: boolean

  @column()
  declare customization_allowed: boolean

  @column()
  declare payment_type: string

  @column()
  declare status: 'active' | 'inactive' | 'suspended' // "active", "inactive", "suspended"
  @hasMany(() => ProductOption, {
    foreignKey: 'service_product_id',
  })
  declare options: HasMany<typeof ProductOption>

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations

  @belongsTo(() => Service, { foreignKey: 'id' })
  declare service: BelongsTo<typeof Service>

  @belongsTo(() => User, { foreignKey: 'created_by'})
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>
}
