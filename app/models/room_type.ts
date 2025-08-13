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
  declare default_price : number

  @column({ columnName: 'short_code' })
  declare shortCode: string

  @column({ columnName: 'room_type_name' })
  declare roomTypeName: string

  @column({ columnName: 'base_adult' })
  declare baseAdult: number

  @column({ columnName: 'base_child' })
  declare baseChild: number

  @column({ columnName: 'max_adult' })
  declare maxAdult: number

  @column({ columnName: 'max_child' })
  declare maxChild: number

  @column({ columnName: 'publish_to_website' })
  declare publishToWebsite: boolean

  @column({
    columnName: 'room_amenities',
    serialize: (value: number[] | null) => value,
    prepare: (value: number[] | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | number[] | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return Array.isArray(value) ? value : null;
    }
  })
  declare roomAmenities: number[] | null

  @column()
  declare color: string

  @column({ columnName: 'default_web_inventory' })
  declare defaultWebInventory: number

  @column({ columnName: 'sort_order' })
  declare sortOrder: number

  // Enhanced traceability fields
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column({ columnName: 'created_by_user_id' })
  declare createdByUserId: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column({ columnName: 'updated_by_user_id' })
  declare updatedByUserId: number | null

  @column({ columnName: 'is_deleted' })
  declare isDeleted: boolean

  @column.dateTime({ columnName: 'deleted_at' })
  declare deletedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @hasMany(() => Room)
  declare rooms: HasMany<typeof Room>

  @hasMany(() => RoomRate)
  declare roomRates: HasMany<typeof RoomRate>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'updatedByUserId' })
  declare updatedByUser: BelongsTo<typeof User>

  // Query scopes for soft deletion
  static scopeActive(query: any) {
    return query.where('is_deleted', false)
  }

  static scopeWithDeleted(query: any) {
    return query
  }

  static scopeOnlyDeleted(query: any) {
    return query.where('is_deleted', true)
  }

  // Soft delete method
  async softDelete() {
    this.isDeleted = true
    this.deletedAt = DateTime.now()
    await this.save()
  }

  // Restore method
  async restore() {
    this.isDeleted = false
    this.deletedAt = null
    await this.save()
  }

  // Computed properties
  get isActive() {
    return !this.isDeleted
  }

  get displayName() {
    return `${this.roomTypeName} (${this.shortCode})`
  }

  get totalCapacity() {
    return this.maxAdult + this.maxChild
  }

  get baseCapacity() {
    return this.baseAdult + this.baseChild
  }
}
