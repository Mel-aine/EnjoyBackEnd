import { DateTime } from 'luxon'
import { BaseModel, column,belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Reservation from '#models/reservation'

export default class Comment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare user_id: number

  @column()
  declare reservation_id: number

  @column()
  declare rating: number

  @column()
  declare appreciation: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relations
  @belongsTo(() => User, { foreignKey: 'id),' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Reservation, { foreignKey: 'id' })
  declare reservation: BelongsTo<typeof Reservation>
}
