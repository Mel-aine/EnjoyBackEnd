
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Supplier from '#models/supplier'
import User from '#models/user'
import PurchaseOrderLine from '#models/purchase_order_line'

export default class PurchaseOrder extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare supplier_id: number

  @column.dateTime()
  declare order_datetime: DateTime

  @column.date()
  declare estimated_delivery_date: DateTime | null

  @column.date()
  declare actual_delivery_date: DateTime | null

  @column()
  declare order_status:
    | 'Pending'
    | 'Ordered'
    | 'PartiallyReceived'
    | 'Received'
    | 'Cancelled'
    | 'Closed'
    | 'Disputed'

  @column()
  declare total_order_amount: number

  @column()
  declare ordering_user_id: number

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Supplier, { foreignKey: 'supplier_id' })
  declare supplier: BelongsTo<typeof Supplier>

  @belongsTo(() => User, { foreignKey: 'ordering_user_id' })
  declare orderingUser: BelongsTo<typeof User>

  @hasMany(() => PurchaseOrderLine, { foreignKey: 'po_id' })
  declare lines: HasMany<typeof PurchaseOrderLine>
}
