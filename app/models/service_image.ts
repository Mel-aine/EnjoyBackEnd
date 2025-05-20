import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class ServiceImage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare service_id: number

  @column()
  declare image_url: string

  @column()
  declare is_primary: boolean

  @column()
  declare caption: string | null

  @column()
  declare created_by: number | null

  @belongsTo(() => User, {
    foreignKey: 'created_by',
  })
  declare creator: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}