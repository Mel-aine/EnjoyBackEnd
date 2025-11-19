import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'
 

export default class SupportTicket extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare assignedTime: number

  @column()
  declare ticketCode: string
  @column()
  declare category: 'bug' | 'suggestion' | 'question'

  @column()
  declare module: string

  @column()
  declare impact: 'tous' | 'plusieurs' | 'un' | 'rapport'

  @column()
  declare severity: 'critical' | 'high' | 'low'

  @column({
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | object | null) => {
      if (value === null) return null
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return null
        }
      }
      return typeof value === 'object' ? value : null
    },
  })
  declare description: {
    full: string
    steps: string[]
    expected: string
    actual: string
  }

  @column({
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | object | null) => {
      if (value === null) return null
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return null
        }
      }
      return typeof value === 'object' ? value : null
    },
  })
  declare context: {
    pageUrl: string
    userAgent: string
    userId?: number
    hotelId?: number
    hotelName?: string
    pmsVersion?: string
    entityId?: string
    sessionRecordingUrl?: string
  }

  @column()
  declare callbackPhone: string | null

  @column()
  declare status: 'open' | 'in_progress' | 'resolved' | 'closed'

  @column()
  declare hotelId: number | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @column({
    serialize: (value: string[] | null) => value,
    prepare: (value: string[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | string[] | null) => {
      if (value === null) return null
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          return Array.isArray(parsed) ? parsed : null
        } catch {
          return null
        }
      }
      return Array.isArray(value) ? value : null
    },
  })
  declare attachments: string[] | null
}