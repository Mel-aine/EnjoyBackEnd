import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import User from '#models/user'

export default class Amenity extends BaseModel {

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'amenity_name' })
  declare amenityName: string

  @column({ columnName: 'amenity_type' })
  declare amenityType: string

  @column({ columnName: 'sort_key' })
  declare sortKey: number

  @column()
  declare status: string

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  // Enhanced traceability and compliance fields
  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column({ columnName: 'created_by_user_id' })
  declare createdByUserId: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @column({ columnName: 'updated_by_user_id' })
  declare updatedByUserId: number | null

  @column({ columnName: 'is_deleted' })
  declare isDeleted: boolean

  @column.dateTime({ columnName: 'deleted_at' })
  declare deletedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel, {
    foreignKey: 'hotelId',
  })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'updatedByUserId',
  })
  declare updatedByUser: BelongsTo<typeof User>

  // Query scopes for soft deletion
  public static scopeActive() {
    return this.query().where('is_deleted', false)
  }

  public static scopeWithDeleted() {
    return this.query()
  }

  public static scopeOnlyDeleted() {
    return this.query().where('is_deleted', true)
  }

  // Soft delete method
  public async softDelete(userId?: number) {
    this.isDeleted = true
    this.deletedAt = DateTime.now()
    if (userId) {
      this.updatedByUserId = userId
    }
    await this.save()
  }

  // Restore method
  public async restore(userId?: number) {
    this.isDeleted = false
    this.deletedAt = null
    if (userId) {
      this.updatedByUserId = userId
    }
    await this.save()
  }
}