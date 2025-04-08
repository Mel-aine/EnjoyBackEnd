import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ServiceProduct from '#models/service_product'
import User from '#models/user'
import Option from '#models/option'

export default class ProductionOption extends BaseModel {
  @column({ isPrimary: true })
  declare id: number


  @column()
  declare service_product_id: number

  @column()
  declare option_id: number

  @column()
  declare option_price: number

  @column()
  declare option_type: string

  @column()
  declare value: string

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => ServiceProduct, { foreignKey: 'id' })
  declare serviceProduct: BelongsTo<typeof ServiceProduct>

  @belongsTo(() => Option, { foreignKey: 'id' })
  declare option: BelongsTo<typeof Option>


  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>
}
