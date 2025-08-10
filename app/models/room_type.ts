import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import Room from './room.js'
import RoomRate from './room_rate.js'
import User from './user.js'

export default class RoomType extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare typeName: string

  @column()
  declare typeCode: string

  @column()
  declare description: string

  @column()
  declare maxOccupancy: number

  @column()
  declare baseRate: number

  @column()
  declare sizeSqm: number

  @column()
  declare bedCount: number

  @column()
  declare bedType: string

  @column()
  declare amenities: object

  @column()
  declare features: object

  @column()
  declare viewType: string

  @column()
  declare smokingAllowed: boolean

  @column()
  declare petFriendly: boolean

  @column()
  declare status: string

  @column()
  declare images: object

  @column()
  declare cancellationPolicy: string

  @column()
  declare sortOrder: number

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

  @hasMany(() => Room)
  declare rooms: HasMany<typeof Room>

  @hasMany(() => RoomRate)
  declare roomRates: HasMany<typeof RoomRate>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  // Computed properties
  get isActive() {
    return this.status === 'active'
  }

  get displayName() {
    return `${this.typeName} (${this.typeCode})`
  }
}