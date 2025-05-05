import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'

export default class Expense extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare supplierName: string

  @column()
  declare invoiceNumber: string

  @column()
  declare category: string

  @column()
  declare department: string

  @column.date()
  declare date: DateTime

  @column.date()
  declare dueDate: DateTime | null

  @column()
  declare description: string | null

  @column()
  declare amountBeforeTax: number

  @column()
  declare taxRate: number

  @column()
  declare status: 'paid' | 'unpaid' | 'pending' | 'overdue'

  @column()
  declare paymentMethod: string

  @column()
  declare service_id: number

  @belongsTo(() => Service, { foreignKey: 'service_id' })
  declare service: BelongsTo<typeof Service>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}