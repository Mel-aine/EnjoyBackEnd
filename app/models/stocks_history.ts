import { DateTime } from 'luxon'
import { BaseModel, column , belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import User from '#models/user'

export default class StocksHistory extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare action_type: string | null

  @column()
  declare user_id: number | null

  @column()
  declare service_id: number | null

  @column()
  declare resource_type: string | null

  @column()
  declare resource_id: number | null

  @column()
  declare action_description: string | null

  @column()
  declare old_values: Record<string, any> | null

  @column()
  declare new_values: Record<string, any> | null


 @belongsTo(() => Service, { foreignKey: 'service_id' })
   declare service: BelongsTo<typeof Service>

  @belongsTo(() => User, { foreignKey: 'user_id' })
   declare user: BelongsTo<typeof User>
}
