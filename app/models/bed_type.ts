import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class BedType extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare shortCode: string

  @column()
  declare bedTypeName: string

  @column()
  declare hotelId: number

  @column()
  declare status: 'Active' | 'Inactive'

  // Enhanced traceability fields
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column()
  declare createdByUserId: number

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare updatedByUserId: number

  @column()
  declare isDeleted: boolean

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdBy: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'updatedByUserId',
  })
  declare updatedBy: BelongsTo<typeof User>

  // Query scopes
  static active = (query: any) => {
    query.where('is_deleted', false)
  }
}