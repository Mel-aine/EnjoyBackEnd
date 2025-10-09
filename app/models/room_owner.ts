import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Room from './room.js'
import Hotel from './hotel.js'

export default class RoomOwner extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  // Hotel association
  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  // Personal Information
  @column()
  declare name: string

  @column()
  declare businessName: string | null

  @column()
  declare address: string | null

  @column()
  declare country: string | null

  @column()
  declare state: string | null

  @column()
  declare city: string | null

  @column()
  declare zip: string | null

  @column()
  declare phone: string | null

  @column()
  declare fax: string | null

  @column()
  declare mobile: string | null

  @column()
  declare email: string | null

  // Commission Information
  @column()
  declare commissionPlan: 'percentage_all_nights' | 'fixed_per_night' | 'fixed_per_stay' | null

  @column()
  declare commissionValue: number | null

  @column()
  declare rateType: 'regular' | 'special' | 'allocated' | null

  @column()
  declare roomInventoryType: 'regular' | 'allocated' | null

  @column()
  declare openingBalance: number

  // User Creation Flag
  @column()
  declare createUser: boolean

  // Audit Fields
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column()
  declare createdByUserId: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare updatedByUserId: number | null

  @column()
  declare isDeleted: boolean

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel, {
    foreignKey: 'hotelId',
  })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdBy: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'updatedByUserId',
  })
  declare updatedBy: BelongsTo<typeof User>

  @manyToMany(() => Room, {
    pivotTable: 'room_owner_assignments',
  })
  declare rooms: ManyToMany<typeof Room>

  // Query scopes for soft delete functionality
  static withoutDeleted() {
    return this.query().where('is_deleted', false)
  }

  static withDeleted() {
    return this.query()
  }

  static onlyDeleted() {
    return this.query().where('is_deleted', true)
  }

  // Soft delete method
  async softDelete(userId?: number) {
    this.isDeleted = true
    this.deletedAt = DateTime.now()
    if (userId) {
      this.updatedByUserId = userId
    }
    await this.save()
  }

  // Restore method
  async restore(userId?: number) {
    this.isDeleted = false
    this.deletedAt = null
    if (userId) {
      this.updatedByUserId = userId
    }
    await this.save()
  }
}