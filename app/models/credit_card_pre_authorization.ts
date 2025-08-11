import { DateTime } from 'luxon'
import { BaseModel, column,belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Folio from '#models/folio'

export default class CreditCardPreAuthorization extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

   @column()
  declare folio_id: number

  @column()
  declare card_last_four_digits: string

  @column()
  declare card_expiry_date: string

  @column()
  declare authorized_amount: number

  @column.dateTime()
  declare authorization_datetime: DateTime

  @column.dateTime()
  declare expiration_datetime?: DateTime | null

  @column()
  declare status: 'Authorized' | 'Captured' | 'Voided' | 'Expired' | 'Failed' | 'Released'

  @column()
  declare gateway_reference: string

  @column()
  declare transaction_response_code?: string | null

  @column({ columnName: 'created_by' })
  declare created_by?: number | null

  @column({ columnName: 'last_modified_by' })
  declare last_modified_by?: number | null
  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => Folio, { foreignKey: 'folio_id' })
  declare folio: BelongsTo<typeof Folio>


  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
