import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class NotificationTemplate extends BaseModel {
  public static table = 'notification_templates'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP'

  @column()
  declare locale: string

  @column({ columnName: 'subject_template' })
  declare subjectTemplate: string

  @column({ columnName: 'content_template' })
  declare contentTemplate: string

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column({ columnName: 'updated_by' })
  declare updatedBy: number | null

  @column.dateTime({ columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at' })
  declare updatedAt: DateTime | null
}

