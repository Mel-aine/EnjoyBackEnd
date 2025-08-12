
import { DateTime } from 'luxon'
import { BaseModel, column, hasMany,belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany , BelongsTo } from '@adonisjs/lucid/types/relations'
import BankTransaction from '#models/bank_transaction'
import Hotel from '#models/hotel'


export default class BankAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare account_name: string

  @column()
  declare bank_name: string

  @column()
  declare account_number: string

  @column()
  declare iban: string | null

  @column()
  declare swift_bic: string | null

  @column()
  declare currency: string

  @column()
  declare is_active: boolean

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @hasMany(() => BankTransaction, {
    foreignKey: 'bank_account_id',
  })
  declare bankTransactions: HasMany<typeof BankTransaction>

  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>
}
