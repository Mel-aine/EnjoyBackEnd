import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Hotel from './hotel.js'

export default class BookingSource extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare sourceName: string

  @column()
  declare sourceCode: string

  @column()
  declare sourceType: string

  @column()
  declare description: string

  @column()
  declare commissionRate: number

  @column()
  declare contactPerson: string

  @column()
  declare contactEmail: string

  @column()
  declare contactPhone: string

  @column()
  declare address: string

  @column()
  declare city: string

  @column()
  declare country: string

  @column()
  declare website: string

  @column()
  declare apiEndpoint: string

  @column()
  declare apiCredentials: object

  @column()
  declare contractDetails: object

  @column.date()
  declare contractStartDate: DateTime

  @column.date()
  declare contractEndDate: DateTime

  @column()
  declare paymentTerms: string

  @column()
  declare cancellationPolicy: string

  @column()
  declare isActive: boolean

  @column({ columnName: 'priority_level' })
  declare priority: number

  @column()
  declare notes: string

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  // Computed properties
  get displayName() {
    return `${this.sourceName} (${this.sourceCode})`
  }

  get isOnline() {
    return ['ota', 'website', 'mobile_app'].includes(this.sourceType)
  }
}