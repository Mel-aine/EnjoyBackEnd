import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Service from '#models/service'

export default class TravelRoute extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare service_id: number

  @column()
  declare route_name: string

  @column()
  declare origin: string | null

  @column()
  declare destination: string | null

  @column()
  declare distance: number | null

  @column()
  declare estimated_duration: string | null


  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value) => typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare stops: string[] | null

  @column()
  declare route_map: string | null

  @column()
  declare status: 'active' | 'inactive' | 'seasonal'

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @belongsTo(() => Service, { foreignKey: 'service_id' })
  declare service: BelongsTo<typeof Service>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
