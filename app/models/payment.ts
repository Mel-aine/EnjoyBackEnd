import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Reservation from '#models/reservation'
import Order from '#models/order'
import Services from '#models/service'

export default class Payment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
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
  declare notes: string | null

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
