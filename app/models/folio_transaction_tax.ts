import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import FolioTransaction from './folio_transaction.js'
import TaxRate from './tax_rate.js'

export default class FolioTransactionTax extends BaseModel {
  public static table = 'folio_transaction_taxes'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare folioTransactionId: number

  @column()
  declare taxRateId: number

  @column()
  declare taxAmount: number

  @column()
  declare taxRatePercentage: number

  @column()
  declare taxableAmount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => FolioTransaction, { foreignKey: 'folioTransactionId' })
  declare folioTransaction: BelongsTo<typeof FolioTransaction>

  @belongsTo(() => TaxRate, { foreignKey: 'taxRateId' })
  declare taxRate: BelongsTo<typeof TaxRate>
}