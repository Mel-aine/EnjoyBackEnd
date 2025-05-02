import { DateTime } from 'luxon'
import { BaseModel, column ,hasMany} from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ProductService from '#models/product_service'

export default class Department extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare name: string

  @column()
  declare description: string

  @column()
  declare product_id: number

  // Relations
  @hasMany(() => ProductService, { foreignKey: 'product_id' })
  declare products: HasMany<typeof ProductService>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
