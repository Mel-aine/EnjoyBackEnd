import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany, scope, afterUpdate } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import RoomType from './room_type.js'
import BedType from './bed_type.js'
import ReservationRoom from './reservation_room.js'
import CleaningStatus from './cleaning_status.js'
import MaintenanceRequest from './maintenance_request.js'
import User from './user.js'
import TaxRate from './tax_rate.js'
import RoomBlock from './room_block.js'
import WorkOrder from './work_order.js'
import HouseKeeper from './house_keeper.js'

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

 @column({
  consume: (value) => {
    if (!value) return []
    if (typeof value === 'string') return JSON.parse(value)
    return value // déjà un array
  },
  prepare: (value) => JSON.stringify(value),
})
declare housekeepingRemarks: any[]




  @column()
  declare maxOccupancy: number

  @column()
  declare actualSize: number

  @column()
  declare bedTypeId: number

  @column()
  declare assignedHousekeeperId: number | null

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

  @column({
    consume: (value: string) => {
      try {
        if (!value) return []
        // Si c'est déjà un tableau, le retourner
        if (Array.isArray(value)) return value
        // Si c'est une string, essayer de la parser comme JSON
        if (typeof value === 'string') {
          // Vérifier si c'est une URL simple (pas un JSON)
          if (value.startsWith('http')) {
            return [value] // Convertir en tableau avec un élément
          }
          return JSON.parse(value)
        }
        return []
      } catch {
        // Si le parsing échoue, retourner un tableau vide
        return []
      }
    },
    prepare: (value: string[]) => {
      if (!value || value.length === 0) return '[]'
      return JSON.stringify(value)
    }
  })
  declare images: string[]

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

  @column({ columnName: 'short_code' })
  declare shortCode: string | null



  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => RoomType)
  declare roomType: BelongsTo<typeof RoomType>

  @belongsTo(() => BedType)
  declare bedType: BelongsTo<typeof BedType>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => HouseKeeper, { foreignKey: 'assignedHousekeeperId' })
  declare assignedHousekeeper: BelongsTo<typeof HouseKeeper>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => ReservationRoom)
  declare reservationRooms: HasMany<typeof ReservationRoom>

   @hasMany(() => RoomBlock, { foreignKey: 'roomId' })
  declare blocks: HasMany<typeof RoomBlock>

  @hasMany(() => WorkOrder, { foreignKey: 'roomId' })
  declare workOrders: HasMany<typeof WorkOrder>


  @hasMany(() => CleaningStatus)
  declare cleaningStatuses: HasMany<typeof CleaningStatus>

  @hasMany(() => MaintenanceRequest)
  declare maintenanceRequests: HasMany<typeof MaintenanceRequest>

  @manyToMany(() => TaxRate, {
    pivotTable: 'room_tax_rates',
    localKey: 'id',
    pivotForeignKey: 'room_id',
    relatedKey: 'taxRateId',
    pivotRelatedForeignKey: 'tax_rate_id'
  })
  declare taxRates: ManyToMany<typeof TaxRate>

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

  @afterUpdate()
  public static async notifyOnStatusChange(model: Room) {
    try {
      const dirty = (model as any).$dirty || {}
      const statusChanged = Object.prototype.hasOwnProperty.call(dirty, 'status')
      const hkChanged = Object.prototype.hasOwnProperty.call(dirty, 'housekeepingStatus')
      if (!statusChanged && !hkChanged) return

      // Defer notifications so they run after the update lifecycle
      setImmediate(async () => {
        try {
          const NotificationService = (await import('#services/notification_service')).default
          const Department = (await import('#models/department')).default
          const ServiceUserAssignment = (await import('#models/service_user_assignment')).default

          const hotelId = model.hotelId
          const roomId = model.id
          const actorId = (model as any).lastModifiedBy || null

          // Resolve Front Office and Housekeeping departments
          const deptNames = ['Front Office', 'Housekeeping']
          const depts = await Department.query()
            .where('hotel_id', hotelId)
            .whereIn('name', deptNames)
          const deptIds = depts.map((d: any) => d.id)

          let recipients: Array<{ recipientType: 'STAFF'; recipientId: number }> = []
          if (deptIds.length > 0) {
            const assignments = await ServiceUserAssignment.query()
              .where('hotel_id', hotelId)
              .whereIn('department_id', deptIds)
              .select('user_id')
            const uniq = new Set<number>()
            for (const a of assignments as any[]) {
              const uid = a.user_id
              if (uid && !uniq.has(uid)) {
                uniq.add(uid)
                recipients.push({ recipientType: 'STAFF', recipientId: uid })
              }
            }
          }

          if (recipients.length === 0) return

          // Build variables
          const prevStatus = (model as any)?.$original?.status ?? ''
          const newStatus = model.status ?? ''
          const prevHK = (model as any)?.$original?.housekeepingStatus ?? ''
          const newHK = model.housekeepingStatus ?? ''

          // Send main room status change notification
          if (statusChanged) {
            const vars = await NotificationService.buildVariables('ROOM_STATUS_UPDATED', {
              hotelId,
              roomId,
              extra: { OldStatus: prevStatus, NewStatus: newStatus },
            })
            await NotificationService.sendToManyWithTemplate({
              templateCode: 'ROOM_STATUS_UPDATED',
              recipients,
              variables: vars,
              relatedEntityType: 'Room',
              relatedEntityId: roomId,
              actorId: actorId || undefined,
              hotelId,
              channelOverride: 'IN_APP',
            })
          }

          // Send housekeeping status change notification if applicable
          if (hkChanged) {
            const varsHK = await NotificationService.buildVariables('HOUSEKEEPING_STATUS_UPDATED', {
              hotelId,
              roomId,
              extra: { OldStatus: prevHK, NewStatus: newHK },
            })
            await NotificationService.sendToManyWithTemplate({
              templateCode: 'HOUSEKEEPING_STATUS_UPDATED',
              recipients,
              variables: varsHK,
              relatedEntityType: 'Room',
              relatedEntityId: roomId,
              actorId: actorId || undefined,
              hotelId,
              channelOverride: 'IN_APP',
            })
          }
        } catch (innerErr) {
          console.warn('Room status notification failed:', (innerErr as any)?.message)
        }
      })
    } catch (err) {
      console.warn('notifyOnStatusChange hook error:', (err as any)?.message)
    }
  }
}
