import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Department from '#models/department'
import User from '#models/user'

export default class Expense extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare department_id: number | null

  @column()
  declare supplier_id: number | null

  @column()
  declare expense_category_id: number

  @column()
  declare invoice_number: string | null

  @column()
  declare description: string

  @column()
  declare amount_before_tax: number

  @column()
  declare tax_rate: number

  @column()
  declare tax_amount: number | null

  @column()
  declare total_amount: number | null

  @column()
  declare expense_date: Date

  @column()
  declare due_date: Date | null

  @column()
  declare payment_date: Date | null

  @column()
  declare payment_method: string

  @column()
  declare payment_reference: string | null

  @column()
  declare receipt_image: string | null

  @column()
  declare status: 'pending' | 'paid' | 'cancelled' | 'disputed'

  @column()
  declare notes: string | null

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column()
  declare hotel_id: number

  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Department, { foreignKey: 'department_id' })
  declare department: BelongsTo<typeof Department>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
