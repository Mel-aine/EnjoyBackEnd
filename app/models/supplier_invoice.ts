import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Supplier from '#models/supplier'
import PurchaseOrder from '#models/purchase_order'


export default class SupplierInvoice extends BaseModel {
  @column({ isPrimary: true })
  declare id: number


  @column()
  declare hotel_id: number

  @column()
  declare supplier_id: number

  @column()
  declare invoice_number: string

  @column.date()
  declare invoice_date: DateTime

  @column.date()
  declare due_date: DateTime

  @column()
  declare total_amount: number

  @column()
  declare amount_paid: number

  @column()
  declare payment_status:
    | 'Pending'
    | 'Partial'
    | 'Paid'
    | 'Overdue'
    | 'Disputed'
    | 'Voided'

  @column()
  declare description: string | null

  @column()
  declare purchase_order_id: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Supplier, { foreignKey: 'supplier_id' })
  declare supplier: BelongsTo<typeof Supplier>

  @belongsTo(() => PurchaseOrder, { foreignKey: 'purchase_order_id' })
  declare purchaseOrder: BelongsTo<typeof PurchaseOrder>
}
