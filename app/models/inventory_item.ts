import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import InventoryCategory from '#models/inventory_category'
import PurchaseOrderLine from '#models/purchase_order_line'

export default class InventoryItem extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare category_id: number

  @column()
  declare item_name: string

  @column()
  declare unit_of_measure: 'unit'| 'kg' | 'liter' | 'box' | 'piece' | 'gallon' | 'pound' | 'meter' | 'case' | 'pack' | 'bottle' | 'can' | 'roll'| 'sheet' | 'other'

  @column()
  declare min_stock_quantity: number

  @column()
  declare average_purchase_price: number

  @column()
  declare description: string | null

  @column()
  declare sku: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => InventoryCategory, { foreignKey: 'category_id' })
  declare category: BelongsTo<typeof InventoryCategory>

  @hasMany(() => PurchaseOrderLine, { foreignKey: 'item_id' })
  declare purchaseOrderLines: HasMany<typeof PurchaseOrderLine>
}
