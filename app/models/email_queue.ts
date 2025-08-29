import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import EmailTemplate from './email_template.js'
import EmailLog from './email_log.js'

export enum EmailStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed'
}

export default class EmailQueue extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare emailTemplateId: number

  @column()
  declare recipientEmail: string

  @column({
    serialize: (value: any) => {
      return typeof value === 'string' ? JSON.parse(value) : value
    },
    prepare: (value: any) => {
      return typeof value === 'object' ? JSON.stringify(value) : value
    }
  })
  declare dataContext: object

  @column()
  declare status: EmailStatus

  @column()
  declare retryCount: number

  @column.dateTime()
  declare lastAttemptAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => EmailTemplate)
  declare emailTemplate: BelongsTo<typeof EmailTemplate>

  @hasMany(() => EmailLog)
  declare emailLogs: HasMany<typeof EmailLog>
}