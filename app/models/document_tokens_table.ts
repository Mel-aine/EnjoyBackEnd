import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class DocumentTokens extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

   @column()
  declare token: string

  @column()
  declare filename: string

  @column()
  declare filePath: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}