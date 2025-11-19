import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import User from '#models/user'
import TemplateCategory from '#models/template_category'
import EmailAccount from '#models/email_account'

export default class EmailTemplate extends BaseModel {
  public static table = 'email_templates'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'name' })
  declare name: string

  @column()
  declare templateCategoryId: number | null

  @column()
  declare autoSend: 'Manual' | 'Check-in' | 'Check-out' | 'Reservation Created' | 'Reservation Modified' | 'Reservation Cancelled' | 'Invoice Generated' | 'Payment Received' | null

  @column()
  declare attachment: string | null

  @column()
  declare emailAccountId: number | null

  @column.date()
  declare scheduleDate: DateTime | null

  @column()
  declare subject: string

  @column({ columnName: 'message_body' })
  declare messageBody: string

  @column()
  declare hotelId: number | null

  @column()
  declare isDeleted: boolean | null

  @column()
  declare isDeleable: boolean | null

  @column({
    prepare: (value: string[] | null) => {
      if (!value) return null
      return Array.isArray(value) ? value : []
    },
    consume: (value: any) => {
      if (!value) return []
      if (Array.isArray(value)) return value
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return []
        }
      }
      return []
    }
  })
  declare cc: string[] | null

  @column({
    prepare: (value: string[] | null) => {
      if (!value) return null
      return Array.isArray(value) ? value : []
    },
    consume: (value: any) => {
      if (!value) return []
      if (Array.isArray(value)) return value
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return []
        }
      }
      return []
    }
  })
  declare bcc: string[] | null


  @column()
  declare createdBy: number | null

  @column()
  declare deletedBy: number | null

  @column()
  declare lastModifiedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel, {
    foreignKey: 'hotelId',
  })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => TemplateCategory, {
    foreignKey: 'templateCategoryId',
  })
  declare templateCategory: BelongsTo<typeof TemplateCategory>

  @belongsTo(() => EmailAccount, {
    foreignKey: 'emailAccountId',
  })
  declare emailAccount: BelongsTo<typeof EmailAccount>

  @belongsTo(() => User, {
    foreignKey: 'createdBy',
  })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'lastModifiedBy',
  })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'deletedBy',
  })
  declare deleter: BelongsTo<typeof User>

  // Validation methods
  public static validateAutoSend(autoSend: string): boolean {
    const validValues = ['Manual', 'Check-in', 'Check-out', 'Reservation Created', 'Reservation Modified', 'Reservation Cancelled', 'Invoice Generated', 'Payment Received']
    return validValues.includes(autoSend)
  }

  public static validateSubject(subject: string): boolean {
    return subject.trim().length > 0 && subject.length <= 255
  }

  public static validateMessageBody(messageBody: string): boolean {
    return messageBody.trim().length > 0
  }
}
