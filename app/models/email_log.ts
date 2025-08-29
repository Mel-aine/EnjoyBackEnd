import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import EmailQueue from './email_queue.js'

export default class EmailLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare emailQueueId: number

  @column.dateTime()
  declare sentAt: DateTime

  @column()
  declare success: boolean

  @column()
  declare responseMessage: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => EmailQueue)
  declare emailQueue: BelongsTo<typeof EmailQueue>
}