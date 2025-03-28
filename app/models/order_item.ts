import { DateTime } from 'luxon'
import { BaseModel, column,belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Order from '#models/order'
import ServiceProduct from '#models/service_product'


export default class OrderItem extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare order_id: number

  @column()
  declare service_product_id: number

  @column()
  declare quantity: number

  @column()
  declare price_per_unit: number

  @column()
  declare subtotal: number

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Order, { foreignKey: 'id' })
  declare order: BelongsTo<typeof Order>

  @belongsTo(() => ServiceProduct, { foreignKey: 'service_product_id' })
  declare serviceProduct: BelongsTo<typeof ServiceProduct>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare createdBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare lastModifiedBy: BelongsTo<typeof User>
}
