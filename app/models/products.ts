
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import StockCategory from '#models/stock_category'
import ProductType from '#models/product_type'


export default class Products extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code?: string

  @column()
  declare name: string

  @column()
  declare quantity_available: number

  @column()
  declare service_id: number

  @column()
  declare product_type_id?: number

  @column()
  declare stock_category_id?: number

  @column()
  declare min_stock_level: number

  @column()
  declare is_available: boolean

  @column()
  declare availability_schedule?: any

  @column()
  declare product_image?: string

  @column()
  declare customization_allowed: boolean

  @column()
  declare payment_type: 'direct' | 'deferred' | 'both'

  @column()
  declare description: string

  @column()
  declare price: number

  @column()
  declare supplier_name?: string

  @column()
  declare status: 'active' | 'inactive' | 'out_of_stock' | 'discontinued' | 'coming_soon'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => StockCategory)
  declare category: BelongsTo<typeof StockCategory>

  @belongsTo(() => ProductType)
  declare productType: BelongsTo<typeof ProductType>

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>

}
