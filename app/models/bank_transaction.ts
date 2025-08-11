
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BankAccount from '#models/bank_account'
import GeneralLedger from '#models/general_ledger'

export default class BankTransaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bank_account_id: number

  @column.date()
  declare transaction_date: DateTime

  @column()
  declare transaction_type: 'Deposit' | 'Withdrawal' | 'Fee' | 'Interest' | 'TransferIn' | 'TransferOut' | 'Chargeback'

  @column()
  declare amount: number

  @column()
  declare description: string | null

  @column()
  declare is_reconciled: boolean

  @column.dateTime()
  declare reconciliation_datetime: DateTime | null

  @column()
  declare gl_entry_id: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => BankAccount)
  declare bankAccount: BelongsTo<typeof BankAccount>

  @belongsTo(() => GeneralLedger, { foreignKey: 'gl_entry_id' })
  declare generalLedgerEntry: BelongsTo<typeof GeneralLedger>
}
