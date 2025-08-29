import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import EmailQueue from './email_queue.js'

export default class EmailTemplate extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare templateName: string

  @column()
  declare subject: string

  @column()
  declare bodyHtml: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => EmailQueue)
  declare emailQueues: HasMany<typeof EmailQueue>
}