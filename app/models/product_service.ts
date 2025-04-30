
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import StockCategory from '#models/stock_category'
import Supplier from '#models/supplier'

export default class ProductService  extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare quantity: number

  @column()
  declare service_id: number

  @column()
  declare stock_category_id: number


  @column()
  declare price: number

  @column()
  declare supplier_id: number

  @column()
  declare status: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => StockCategory)
  declare category: BelongsTo<typeof StockCategory>

  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>

}
