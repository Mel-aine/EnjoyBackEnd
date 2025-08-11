import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import RoomType from './room_type.js'
import BedType from './bed_type.js'
import ReservationRoom from './reservation_room.js'
import CleaningStatus from './cleaning_status.js'
import MaintenanceRequest from './maintenance_request.js'
import User from './user.js'

export default class Room extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare roomTypeId: number

  @column()
  declare roomNumber: string

  @column()
  declare floorNumber: number

  @column()
  declare status: string

  @column()
  declare housekeepingStatus: string

  @column()
  declare description: string

  @column()
  declare features: object

  @column()
  declare amenities: object

  @column()
  declare maxOccupancy: number

  @column()
  declare actualSize: number

  @column()
  declare bedTypeId: number

  @column()
  declare phoneExtension: string

  @column()
  declare sortKey: number

  @column()
  declare keyCardAlias: string

  @column()
  declare viewType: string

  @column()
  declare balcony: boolean

  @column()
  declare smokingAllowed: boolean

  @column()
  declare petFriendly: boolean

  @column()
  declare accessible: boolean

  @column()
  declare connecting: boolean

  @column()
  declare connectingRooms: object

  @column()
  declare adjoining: boolean

  @column()
  declare adjoiningRooms: object

  @column()
  declare lastRenovated: DateTime

  @column()
  declare condition: string

  @column()
  declare maintenanceNotes: string

  @column.date()
  declare lastMaintenanceDate: DateTime

  @column.date()
  declare nextMaintenanceDate: DateTime

  @column()
  declare outOfOrderReason: string

  @column.dateTime()
  declare outOfOrderFrom: DateTime

  @column.dateTime()
  declare outOfOrderTo: DateTime

  @column()
  declare images: object

  @column()
  declare virtualTourUrl: string

  @column()
  declare qrCode: string

  @column()
  declare wifiPassword: string

  @column()
  declare safeCode: string

  @column()
  declare minibarItems: object

  @column()
  declare inventoryItems: object

  @column()
  declare energyEfficiencyRating: string

  @column()
  declare carbonFootprint: number

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

  @column()
  declare isDeleted: boolean

  @column.dateTime()
  declare deletedAt: DateTime

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => RoomType)
  declare roomType: BelongsTo<typeof RoomType>

  @belongsTo(() => BedType)
  declare bedType: BelongsTo<typeof BedType>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => ReservationRoom)
  declare reservationRooms: HasMany<typeof ReservationRoom>

  @hasMany(() => CleaningStatus)
  declare cleaningStatuses: HasMany<typeof CleaningStatus>

  @hasMany(() => MaintenanceRequest)
  declare maintenanceRequests: HasMany<typeof MaintenanceRequest>

  // Scopes
  static active = scope((query) => {
    query.where('isDeleted', false)
  })

  // Computed properties
  get isAvailable() {
    return this.status === 'available' && this.housekeepingStatus === 'clean'
  }

  get isOccupied() {
    return this.status === 'occupied'
  }

  get isOutOfOrder() {
    return this.status === 'out_of_order'
  }

  get displayName() {
    return `Room ${this.roomNumber}`
  }
}