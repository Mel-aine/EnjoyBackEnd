import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Reservation from '#models/reservation'
import Order from '#models/order'
import Services from '#models/service'
import Folio from '#models/folio'
import PaymentMethod from '#models/payment_method'

export default class Payment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare folio_id: number

  @column()
  declare payment_method_id: number

  @column()
  declare amount: number

  @column()
  declare currency_code: string

  @column()
  declare exchange_rate: number

  @column()
  declare amount_in_base_currency: number

  @column()
  declare payment_status: 'Pending' | 'Completed' | 'Failed' | 'Cancelled' | 'Refunded' | 'PartiallyRefunded'

  @column()
  declare reference_number: string | null

  @column()
  declare authorization_code: string | null

  @column()
  declare processor_response: string | null

  @column()
  declare notes: string | null

  @column.dateTime()
  declare payment_datetime: DateTime

  @column()
  declare processed_by: number

  @column()
  declare user_id: number

  @column()
  declare reservation_id: number | null

  @column()
  declare order_id: number | null

  @column()
  declare amount_paid: number

  @column()
  declare payment_method: string

  @column()
  declare status: string // "Succeeded", "Pending", "Failed"

  @column()
  declare transaction_id: string

  @column()
  declare payment_details: any | null

  @column.dateTime()
  declare payment_date: DateTime

  @column()
  declare service_id: number

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => Folio, { foreignKey: 'folio_id' })
  declare folio: BelongsTo<typeof Folio>

  @belongsTo(() => PaymentMethod, { foreignKey: 'payment_method_id' })
  declare paymentMethod: BelongsTo<typeof PaymentMethod>

  @belongsTo(() => User, { foreignKey: 'processed_by' })
  declare processor: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Reservation, { foreignKey: 'reservation_id' })
  declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => Order, { foreignKey: 'order_id' })
  declare order: BelongsTo<typeof Order>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => Services, { foreignKey: 'service_id' })
  declare Services: BelongsTo<typeof Services>
}
