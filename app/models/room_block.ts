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


  // 🔹 Hooks pour synchronisation automatique
  @afterSave()
  static async syncAfterSave(roomBlock: RoomBlock) {
    console.log('🔄 ROOM BLOCK AFTER SAVE HOOK TRIGGERED:', roomBlock.id)
    
    // Synchroniser seulement pour les blocs actifs (pending, inProgress)
    if (roomBlock.status === 'pending' || roomBlock.status === 'inProgress') {
      await RoomBlock.syncBlockWithChannex(roomBlock, 'block')
    }
  }

  @afterDelete()
  static async syncAfterDelete(roomBlock: RoomBlock) {
    console.log('🔄 ROOM BLOCK AFTER DELETE HOOK TRIGGERED:', roomBlock.id)
    await RoomBlock.syncBlockWithChannex(roomBlock, 'unblock')
  }

  private static async syncBlockWithChannex(roomBlock: RoomBlock, action: 'block' | 'unblock') {
    const hotel = await roomBlock.related('hotel').query().first()
    
    if (hotel && hotel.channexPropertyId) {
      try {
        const channexBlockService = new ChannexBlockService()
        
        if (action === 'block') {
          await channexBlockService.syncAvailabilityAfterRoomBlock(roomBlock, hotel.channexPropertyId)
        } else {
          await channexBlockService.syncAvailabilityAfterRoomUnblock(roomBlock, hotel.channexPropertyId)
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${action} with Channex:`, error)
        // Ne pas throw pour ne pas bloquer l'opération principale
      }
    } else {
      console.log('⚠️ No hotel or channexPropertyId found for room block sync')
    }
  }
}
