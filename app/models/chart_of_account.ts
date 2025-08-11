import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'


export default class ChartOfAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare account_number: string

  @column()
  declare account_name: string

  @column()
  declare account_type:
    | 'Asset'
    | 'Liability'
    | 'Equity'
    | 'Revenue'
    | 'Expense'
    | 'ContraAsset'
    | 'ContraLiability'
    | 'ContraEquity'
    | 'ContraRevenue'
    | 'ContraExpense'

  @column()
  declare parent_account_id: number | null

  @column()
  declare is_active: boolean

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => ChartOfAccount, { foreignKey: 'parent_account_id' })
  declare parentAccount: BelongsTo<typeof ChartOfAccount>

  @hasMany(() => ChartOfAccount, { foreignKey: 'parent_account_id' })
  declare childAccounts: HasMany<typeof ChartOfAccount>
}
