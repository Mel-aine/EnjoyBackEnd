import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Job extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare type: string

  @column()
  declare payload: any

  @column()
  declare status: 'pending' | 'processing' | 'completed' | 'failed'

  @column()
  declare attempts: number

  @column.dateTime()
  declare availableAt: DateTime | null

  @column()
  declare lastError: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
