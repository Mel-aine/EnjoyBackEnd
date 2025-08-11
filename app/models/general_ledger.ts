
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import User from '#models/user'
import ChartOfAccount from '#models/chart_of_account'

export default class GeneralLedger extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column.dateTime()
  declare transaction_datetime: DateTime

  @column()
  declare debit_account_id: number

  @column()
  declare credit_account_id: number

  @column()
  declare amount: number

  @column()
  declare description: string

  @column()
  declare document_reference: string | null

  @column()
  declare source_type: 'Folio' | 'SupplierInvoice' | 'BankTransfer' | 'Payroll' | 'ManualAdjustment' | 'PurchaseOrder' | 'TaxPayment' | 'AssetDepreciation' | 'RevenueRecognition'

  @column()
  declare source_id_reference: string | null

  @column()
  declare user_id: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => ChartOfAccount, { foreignKey: 'debit_account_id' })
  declare debitAccount: BelongsTo<typeof ChartOfAccount>

  @belongsTo(() => ChartOfAccount, { foreignKey: 'credit_account_id' })
  declare creditAccount: BelongsTo<typeof ChartOfAccount>

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>
}
