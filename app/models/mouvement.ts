import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import ProductService from '#models/product_service'

export default class Mouvement extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
 declare product_id: number

 @column.date()
  declare date: DateTime

  @column()
 declare type: string

  @column()
 declare quantity: number

  @column()
 declare source: string

  @column()
 declare destination: string

  @column()
 declare user: string

  @column()
 declare notes?: string

  @column()
 declare service_id: number

  @belongsTo(() => Service)
 declare service: BelongsTo<typeof Service>

 @belongsTo(() => ProductService)
 declare productService: BelongsTo<typeof ProductService>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
