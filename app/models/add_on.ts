import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Module from '#models/module'

export default class AddOn extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare moduleId: number

  @column()
  declare min: number

  @column()
  declare max: number

  @column()
  declare priceMonth: number

  @column()
  declare priceYear: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Module)
  declare module: BelongsTo<typeof Module>
}
