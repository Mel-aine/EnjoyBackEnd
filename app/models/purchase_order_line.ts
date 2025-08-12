import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PurchaseOrder from '#models/purchase_order'
import InventoryItem from '#models/inventory_item'

export default class PurchaseOrderLine extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare item_id: number

  @column()
  declare ordered_quantity: number

  @column()
  declare negotiated_unit_price: number

  @column()
  declare received_quantity: number

  @column.dateTime()
  declare last_receipt_datetime: DateTime | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => PurchaseOrder, { foreignKey: 'po_id' })
  declare purchaseOrder: BelongsTo<typeof PurchaseOrder>

  @belongsTo(() => InventoryItem, { foreignKey: 'item_id' })
  declare item: BelongsTo<typeof InventoryItem>
}
