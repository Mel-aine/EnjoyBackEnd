import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, afterSave, afterDelete } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Room from './room.js'
import User from './user.js'
import Hotel from './hotel.js'
import RoomType from './room_type.js'
import ChannexBlockService from '#services/channex_block_service'

export default class RoomBlock extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare roomId: number

  @column()
  declare roomTypeId: number

  @column()
  declare status: 'pending' | 'inProgress' | 'completed'

  @column()
  declare hotelId: number

  @column.date()
  declare blockFromDate: DateTime

  @column.date()
  declare blockToDate: DateTime

  @column()
  declare reason: string | null

  @column()
  declare description: string | null

  @column()
  declare blockedByUserId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // 🔹 Relations
  @belongsTo(() => Room , { foreignKey: 'roomId' })
  declare room: BelongsTo<typeof Room>

  @belongsTo(() => User, { foreignKey: 'blockedByUserId' })
  declare blockedBy: BelongsTo<typeof User>

  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => RoomType, { foreignKey: 'roomTypeId' })
  declare roomType: BelongsTo<typeof RoomType>


  @afterSave()
  static async syncAfterSave(roomBlock: RoomBlock) {
    console.log('🔄 ROOM BLOCK AFTER SAVE HOOK TRIGGERED:', {
      id: roomBlock.id,
      status: roomBlock.status,
      fromDate: roomBlock.blockFromDate.toISODate(),
      toDate: roomBlock.blockToDate.toISODate()
    })

    try {
      // Charger les relations nécessaires
      await roomBlock.load('hotel')
      await roomBlock.load('roomType')

      const hotel = roomBlock.hotel
      
      if (!hotel || !hotel.channexPropertyId) {
        console.log('⚠️ No hotel or channexPropertyId found for sync')
        return
      }

      if (!roomBlock.roomType?.channexRoomTypeId) {
        console.log('⚠️ Room type not synced with Channex')
        return
      }

      // Déterminer l'action en fonction du statut
      let action: 'block' | 'unblock' | null = null
      
      if (roomBlock.status === 'pending' || roomBlock.status === 'inProgress') {
        action = 'block'
      } else if (roomBlock.status === 'completed') {
        action = 'unblock'
      }

      if (action) {
        await RoomBlock.syncBlockWithChannex(roomBlock, hotel.channexPropertyId, action)
      }

    } catch (error) {
      console.error('❌ Error in syncAfterSave hook:', error)
      // Ne pas throw pour ne pas bloquer l'opération principale
    }
  }

  @afterDelete()
  static async syncAfterDelete(roomBlock: RoomBlock) {
    console.log('🔄 ROOM BLOCK AFTER DELETE HOOK TRIGGERED:', roomBlock.id)

    try {
      // Charger les relations nécessaires avant suppression
      await roomBlock.load('hotel')
      
      const hotel = roomBlock.hotel
      
      if (hotel && hotel.channexPropertyId) {
        await RoomBlock.syncBlockWithChannex(roomBlock, hotel.channexPropertyId, 'unblock')
      }
    } catch (error) {
      console.error('❌ Error in syncAfterDelete hook:', error)
      // Ne pas throw pour ne pas bloquer l'opération principale
    }
  }

  private static async syncBlockWithChannex(
    roomBlock: RoomBlock, 
    hotelChannexId: string, 
    action: 'block' | 'unblock'
  ) {
    try {
      const channexBlockService = new ChannexBlockService()
      
      if (action === 'block') {
        await channexBlockService.syncAvailabilityAfterRoomBlock(roomBlock, hotelChannexId)
      } else {
        await channexBlockService.syncAvailabilityAfterRoomUnblock(roomBlock, hotelChannexId)
      }
      
      console.log(`✅ Successfully synced ${action} with Channex for room block ${roomBlock.id}`)
    } catch (error) {
      console.error(`❌ Failed to sync ${action} with Channex for room block ${roomBlock.id}:`, error)
      throw error // Relancer pour logging supplémentaire
    }
  }


  get isActive(): boolean {
    return this.status === 'pending' || this.status === 'inProgress'
  }

  get durationInDays(): number {
    return this.blockToDate.diff(this.blockFromDate, 'days').days
  }

  get isCurrent(): boolean {
    const now = DateTime.now()
    return now >= this.blockFromDate && now <= this.blockToDate
  }
}
