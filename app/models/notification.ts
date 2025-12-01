import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import NotificationTemplate from '#models/notification_template'
import Hotel from '#models/hotel'
import User from '#models/user'
import Guest from '#models/guest'

export default class Notification extends BaseModel {
  public static table = 'notifications'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'template_id' })
  declare templateId: number | null

  @column({ columnName: 'recipient_type' })
  declare recipientType: 'GUEST' | 'STAFF' | 'HOUSEKEEPING' | 'MAINTENANCE' | string

  @column({ columnName: 'recipient_id' })
  declare recipientId: number

  @column({ columnName: 'related_entity_type' })
  declare relatedEntityType: string | null

  @column({ columnName: 'related_entity_id' })
  declare relatedEntityId: number | null

  @column()
  declare channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP'

  @column()
  declare subject: string

  @column()
  declare content: string

  @column.dateTime({ columnName: 'sent_at' })
  declare sentAt: DateTime | null

  @column()
  declare status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED'

  @column({ columnName: 'is_read' })
  declare isRead: boolean

  @column({ columnName: 'hotel_id' })
  declare hotelId: number | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column.dateTime({ columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at' })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => NotificationTemplate, { foreignKey: 'templateId' })
  declare template: BelongsTo<typeof NotificationTemplate>

  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  // Recipient relations (use the one matching recipientType)
  @belongsTo(() => User, { foreignKey: 'recipientId' })
  declare recipientUser: BelongsTo<typeof User>

  @belongsTo(() => Guest, { foreignKey: 'recipientId' })
  declare recipientGuest: BelongsTo<typeof Guest>
}
