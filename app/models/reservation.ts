import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Service from '#models/service'

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
  declare status:string

  @column()
  declare total_price: number

  @column()
  declare created_by: number | null

  @column()
  declare total_person: number

  @column()
  declare arrived_date: Date
  @column()
  declare depart_date: Date

  @column()
  declare reservation_time: string

  @column()
  declare payment: string

  @column()
  declare reservation_product: number

  @column()
  declare comment?: string

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => User, { foreignKey: 'id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Service, { foreignKey: 'id' })
  declare service: BelongsTo<typeof Service>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>


}
