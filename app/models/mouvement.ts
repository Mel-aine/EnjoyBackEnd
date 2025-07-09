import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import ProductService from '#models/products'
import Department from '#models/department'
import StockCategory from '#models/stock_category'
import User from '#models/user'

export default class Mouvement extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
 declare product_id: number

  @column()
 declare stock_category_id:  number | null

 @column.date()
  declare date: DateTime

  @column()
 declare type: string

  @column()
 declare quantity: number

  @column()
 declare source: string

  @column()
 declare department_id: number | null

  @column()
 declare user: string

  @column()
 declare notes?: string

  @column()
 declare service_id: number


  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @belongsTo(() => StockCategory, { foreignKey: 'stock_category_id' })
  declare stockCategory: BelongsTo<typeof StockCategory>

  @belongsTo(() => Department, { foreignKey: 'department_id' })
   declare department: BelongsTo<typeof Department>

  @belongsTo(() => Service, { foreignKey: 'service_id' })
 declare service: BelongsTo<typeof Service>

 @belongsTo(() => ProductService, { foreignKey: 'product_id' })
 declare productService: BelongsTo<typeof ProductService>

 @belongsTo(() => User, { foreignKey: 'created_by'})
   declare creator: BelongsTo<typeof User>

   @belongsTo(() => User, { foreignKey: 'last_modified_by' })
   declare modifier: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
