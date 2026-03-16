import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type RequestDemoStatus =
  | 'New'
  | 'Qualified'
  | 'Demo Scheduled'
  | 'Demo Completed'
  | 'Trial'
  | 'Negotiation'
  | 'Converted'
  | 'Lost'
  | 'Junk'

export default class RequestDemo extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare contactName: string

  @column()
  declare companyName: string

  @column()
  declare propertyType: string | null

  @column()
  declare numberOfRooms: number | null

  @column()
  declare phoneNumber: string | null

  @column()
  declare country: string | null

  @column()
  declare email: string

  @column()
  declare preferredLanguage: string | null

  @column()
  declare leadSource: string | null

  @column()
  declare notesMessage: string | null

  @column()
  declare competition: string | null

  @column()
  declare acceptCondition: boolean

  @column()
  declare emailSend: boolean

  @column()
  declare status: RequestDemoStatus

  @column()
  declare ownerId: number | null

  @column.dateTime()
  declare followUpDate: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'ownerId' })
  declare owner: BelongsTo<typeof User>
}
