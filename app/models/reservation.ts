import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo,hasMany  } from '@adonisjs/lucid/orm'
import type { BelongsTo,HasMany} from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Service from '#models/service'
import ReservationServiceProduct from '#models/reservation_service_product'
import Payment from '#models/payment'
export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export default class Reservation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare user_id: number

  @column()
  declare service_id: number

  @column()
  declare reservation_type: string

  @column()
  declare reservation_number: string | null

  @column()
  declare guest_count: number | null

  @column()
  declare special_requests: string | null

  @column()
  declare status: string

  @column()
  declare cancellation_reason: string | null


  @column()
  declare created_by: number | null

  @column()
  declare arrived_date?: DateTime
  @column()
  declare depart_date?: DateTime

  @column()
  declare reservation_time?: string

  @column()
  declare customer_type: string | null

  @column()
  declare company_name: string | null

  @column()
  declare group_name: string | null

  @column()
  declare number_of_seats: number | null

  @column()
  declare booking_source: string | null

  @column.dateTime()
  declare check_in_date: DateTime | null

  @column.dateTime()
  declare check_out_date: DateTime | null

  @column()
  declare number_of_nights: number | null

  @column()
  declare total_amount?: number

  @column()
  declare discount_amount?: number

  @column()
  declare tax_amount?: number

  @column()
  declare final_amount?: number

  @column()
  declare paid_amount?: number

  @column()
  declare remaining_amount: number | null

  @column()
  declare invoice_available: boolean

  @column()
  declare payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'disputed' | 'pending'

  @column()
  declare comment?: string

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Service, { foreignKey: 'service_id' })
  declare service: BelongsTo<typeof Service>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => ReservationServiceProduct, {
    foreignKey: 'reservation_id',
  })
  declare reservationServiceProducts: HasMany<typeof ReservationServiceProduct>

  @hasMany(() => Payment, {
    foreignKey: 'reservation_id',
  })
  declare payments: HasMany<typeof Payment>

}
