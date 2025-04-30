
// app/Models/Supplier.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'

export default class Supplier extends BaseModel {

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare email?: string

  @column()
  declare phone?: string

  @column()
  declare address?: string

  @column()
  declare serviceId?: number

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
