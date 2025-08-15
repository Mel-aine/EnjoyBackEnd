import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Room from './room.js'

export default class LostFound extends BaseModel {
  static table = 'lost_found'

  @column({ isPrimary: true })
  declare id: number

  // Date fields
  @column()
  declare lostOn: string

  @column()
  declare foundOn: string | null

  // Location fields
  @column()
  declare foundLocation: string | null

  @column()
  declare lostLocation: string

  @column()
  declare currentLocation: string | null

  // Item details
  @column()
  declare itemName: string

  @column()
  declare itemColor: string

  @column()
  declare itemValue: string // Using string to handle both number and string values

  // Room relationship
  @column()
  declare roomId: number

  // Complainant information
  @column()
  declare complainantName: string

  @column()
  declare phone: string

  @column()
  declare address: string

  @column()
  declare city: string

  @column()
  declare state: string

  @column()
  declare country: string

  @column()
  declare zipCode: string

  // Status and additional info
  @column()
  declare status: string

  @column()
  declare additionalNotes: string

  @column()
  declare whoFound: string | null

  // Audit fields
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Room)
  declare room: BelongsTo<typeof Room>
}