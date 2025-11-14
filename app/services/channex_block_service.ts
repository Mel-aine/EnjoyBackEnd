// app/Services/ChannexBlockService.ts
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'
import RoomBlock from '#models/room_block'
import RoomType from '#models/room_type'
import Room from '#models/room'
import { DateTime } from 'luxon'

export default class ChannexBlockService {
  private channexService: ChannexService

  constructor() {
    this.channexService = new ChannexService()
  }

  /**
   * Synchroniser la disponibilité après un blocage de chambre
   */
  async syncAvailabilityAfterRoomBlock(roomBlock: RoomBlock, hotelChannexId: string) {
    try {
      logger.info(`🚫 START syncAvailabilityAfterRoomBlock for room block ${roomBlock.id}`, {
        roomBlockId: roomBlock.id,
        hotelChannexId,
        status: roomBlock.status,
        reason: roomBlock.reason,
        blockFromDate: roomBlock.blockFromDate.toISODate(),
        blockToDate: roomBlock.blockToDate.toISODate()
      })

      // Charger les relations nécessaires
      await roomBlock.load('roomType')

      if (!roomBlock.roomType?.channexRoomTypeId) {
        logger.warn(`❌ Cannot sync block - room type not synced for room block ${roomBlock.id}`, {
          roomBlockId: roomBlock.id,
          roomTypeId: roomBlock.roomTypeId,
          channexRoomTypeId: roomBlock.roomType?.channexRoomTypeId
        })
        return
      }

      const impactedDates = this.getImpactedDates(roomBlock.blockFromDate, roomBlock.blockToDate)
      
      // RÉDUIRE la disponibilité due au blocage
      const availabilityData = await this.calculateBlockAvailability(
        roomBlock.roomTypeId,
        roomBlock.roomType.channexRoomTypeId,
        hotelChannexId,
        impactedDates,
        roomBlock,
        'block' // Action de blocage
      )

      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, availabilityData)

      logger.info(`✅ Availability UPDATED after room block ${roomBlock.id}`, {
        roomBlockId: roomBlock.id,
        roomTypeId: roomBlock.roomTypeId,
        channexRoomTypeId: roomBlock.roomType.channexRoomTypeId,
        datesCount: impactedDates.length,
        action: 'block',
        updateSuccess: true
      })

      return updateResult

    } catch (error) {
      logger.error(`❌ FAILED syncAvailabilityAfterRoomBlock for room block ${roomBlock.id}:`, {
        roomBlockId: roomBlock.id,
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }

  /**
   * Synchroniser la disponibilité après levée d'un blocage
   */
  async syncAvailabilityAfterRoomUnblock(roomBlock: RoomBlock, hotelChannexId: string) {
    try {
      logger.info(`🔄 START syncAvailabilityAfterRoomUnblock for room block ${roomBlock.id}`, {
        roomBlockId: roomBlock.id,
        hotelChannexId,
        status: roomBlock.status,
        reason: roomBlock.reason
      })

      // Charger les relations nécessaires
      await roomBlock.load('roomType')

      if (!roomBlock.roomType?.channexRoomTypeId) {
        logger.warn(`❌ Cannot sync unblock - room type not synced for room block ${roomBlock.id}`)
        return
      }

      const impactedDates = this.getImpactedDates(roomBlock.blockFromDate, roomBlock.blockToDate)
      
      // RESTAURER la disponibilité après levée du blocage
      const availabilityData = await this.calculateBlockAvailability(
        roomBlock.roomTypeId,
        roomBlock.roomType.channexRoomTypeId,
        hotelChannexId,
        impactedDates,
        roomBlock,
        'unblock' // Action de déblocage
      )

      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, availabilityData)

      logger.info(`✅ Availability RESTORED after room unblock ${roomBlock.id}`, {
        roomBlockId: roomBlock.id,
        roomTypeId: roomBlock.roomTypeId,
        channexRoomTypeId: roomBlock.roomType.channexRoomTypeId,
        datesCount: impactedDates.length,
        action: 'unblock',
        updateSuccess: true
      })

      return updateResult

    } catch (error) {
      logger.error(`❌ FAILED syncAvailabilityAfterRoomUnblock for room block ${roomBlock.id}:`, {
        roomBlockId: roomBlock.id,
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }

  /**
   * Synchroniser les blocs multiples (pour plusieurs chambres)
   */
  async syncMultipleRoomBlocks(
    roomBlocks: RoomBlock[], 
    hotelChannexId: string, 
    action: 'block' | 'unblock'
  ) {
    try {
      logger.info(`🔄 START syncMultipleRoomBlocks for ${roomBlocks.length} blocks`, {
        blocksCount: roomBlocks.length,
        hotelChannexId,
        action
      })

      const availabilityData = { values: [] as any[] }

      for (const roomBlock of roomBlocks) {
        await roomBlock.load('roomType')

        if (!roomBlock.roomType?.channexRoomTypeId) {
          logger.warn(`❌ Skipping block ${roomBlock.id} - room type not synced`)
          continue
        }

        const impactedDates = this.getImpactedDates(roomBlock.blockFromDate, roomBlock.blockToDate)
        const roomAvailabilityData = await this.calculateBlockAvailability(
          roomBlock.roomTypeId,
          roomBlock.roomType.channexRoomTypeId,
          hotelChannexId,
          impactedDates,
          roomBlock,
          action
        )

        availabilityData.values.push(...roomAvailabilityData.values)
      }

      if (availabilityData.values.length === 0) {
        logger.warn('⚠️ No valid room blocks to sync')
        return
      }

      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, availabilityData)

      logger.info(`✅ Multiple room blocks synced successfully`, {
        blocksProcessed: roomBlocks.length,
        updatesCount: availabilityData.values.length,
        action,
        updateSuccess: true
      })

      return updateResult

    } catch (error) {
      logger.error(`❌ FAILED syncMultipleRoomBlocks:`, {
        blocksCount: roomBlocks.length,
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }

  /**
   * Calculer la disponibilité mise à jour pour un blocage
   */
  private async calculateBlockAvailability(
    roomTypeId: number,
    roomTypeChannexId: string,
    hotelChannexId: string,
    dates: DateTime[],
    roomBlock: RoomBlock,
    action: 'block' | 'unblock'
  ): Promise<any> {
    logger.info(`🧮 Calculating block availability for ${dates.length} dates`, {
      roomTypeId,
      roomTypeChannexId,
      action,
      blockReason: roomBlock.reason
    })

    const values = []

    for (const date of dates) {
      const currentAvailability = await this.getCurrentAvailability(roomTypeId, date)
      
      // Calculer la nouvelle disponibilité selon l'action
      const updatedAvailability = await this.calculateNewBlockAvailability(
        currentAvailability,
        roomBlock,
        date,
        action
      )

      logger.debug(`📊 Block availability calculation for ${date.toISODate()}`, {
        date: date.toISODate(),
        currentAvailability: currentAvailability.availableRooms,
        updatedAvailability: updatedAvailability.availableRooms,
        stopSell: updatedAvailability.stopSell,
        action
      })

      values.push({
        room_type_id: roomTypeChannexId,
        property_id: hotelChannexId,
        date_from: date.toISODate(),
        date_to: date.toISODate(),
        availability: updatedAvailability.availableRooms,
        stop_sell: updatedAvailability.stopSell
      })
    }

    logger.info(`✅ Calculated block availability data for ${values.length} dates`, {
      roomTypeChannexId,
      sampleDate: values[0]?.date_from,
      sampleAvailability: values[0]?.availability
    })

    return { values }
  }

  /**
   * Calculer la nouvelle disponibilité avec gestion des blocs
   */
  private async calculateNewBlockAvailability(
    currentAvailability: { availableRooms: number; stopSell: boolean },
    roomBlock: RoomBlock,
    date: DateTime,
    action: 'block' | 'unblock'
  ): Promise<{ availableRooms: number; stopSell: boolean }> {
    let updatedRooms = currentAvailability.availableRooms

    // Pour un blocage, on réduit de 1 chambre disponible
    // Pour un déblocage, on augmente de 1 chambre disponible
    if (action === 'block') {
      updatedRooms = Math.max(0, currentAvailability.availableRooms - 1)
    } else if (action === 'unblock') {
      updatedRooms = currentAvailability.availableRooms + 1
    }

    // Déterminer si stop sell (si plus de chambres disponibles)
    const stopSell = currentAvailability.stopSell || updatedRooms === 0

    return {
      availableRooms: updatedRooms,
      stopSell
    }
  }

  /**
   * Récupérer la disponibilité actuelle pour une date donnée
   */
  private async getCurrentAvailability(roomTypeId: number, date: DateTime): Promise<{
    availableRooms: number
    stopSell: boolean
  }> {
    try {
      const totalRooms = await this.getTotalRoomsCount(roomTypeId)
      const blockedRooms = await this.getBlockedRoomsCount(roomTypeId, date)
      
      const availableRooms = Math.max(0, totalRooms - blockedRooms)

      logger.debug(`📊 Current availability for roomType ${roomTypeId} on ${date.toISODate()}`, {
        totalRooms,
        blockedRooms,
        availableRooms
      })

      return {
        availableRooms,
        stopSell: availableRooms === 0
      }

    } catch (error) {
      logger.error(`❌ Error getting current availability:`, error)
      return {
        availableRooms: 10,
        stopSell: false
      }
    }
  }

  /**
   * Obtenir le nombre total de chambres pour un room type (depuis la table Room)
   */
  private async getTotalRoomsCount(roomTypeId: number): Promise<number> {
    try {
      const roomsCount = await Room.query()
        .where('room_type_id', roomTypeId)
        .where('is_deleted', false) // Seulement les chambres non supprimées
        .whereNotIn('status', ['out_of_order', 'maintenance']) // Exclure les chambres hors service permanentes
        .count<{ total: number }[]>('* as total')

      const count = roomsCount[0]?.$extras.total || 0
      
      logger.debug(`🏨 Total active rooms for roomType ${roomTypeId}: ${count}`)
      
      return count

    } catch (error) {
      logger.warn(`⚠️ Error counting total rooms, using default 10 for roomType ${roomTypeId}:`, error)
      return 10
    }
  }

  /**
   * Obtenir le nombre de chambres bloquées pour un room type à une date donnée
   */
  private async getBlockedRoomsCount(roomTypeId: number, date: DateTime): Promise<number> {
    try {
      // 1. Compter les blocs de chambres actifs
      const blockedCount = await RoomBlock.query()
        .where('room_type_id', roomTypeId)
        .where('block_from_date', '<=', date.toISODate())
        .where('block_to_date', '>', date.toISODate())
        .whereIn('status', ['pending', 'inProgress']) // Seuls les blocs actifs
        .count('* as total')

      const blockCount = blockedCount[0]?.$extras.total || 0

      // 2. Compter les chambres occupées par des réservations
      const reservedCount = await this.getReservedRoomsCount(roomTypeId, date)

      // 3. Compter les chambres hors-service permanentes
      const outOfOrderCount = await Room.query()
        .where('room_type_id', roomTypeId)
        .where('is_deleted', false)
        .whereIn('status', ['out_of_order', 'maintenance'])
        .count('* as total')

      const permanentBlockCount = outOfOrderCount[0]?.$extras.total || 0

      const totalBlocked = blockCount + reservedCount + permanentBlockCount

      logger.debug(`🚫 Blocked rooms count for roomType ${roomTypeId} on ${date.toISODate()}`, {
        roomBlocks: blockCount,
        reservations: reservedCount,
        permanent: permanentBlockCount,
        totalBlocked
      })

      return totalBlocked

    } catch (error) {
      logger.error(`❌ Error counting blocked rooms:`, error)
      return 0
    }
  }

  /**
   * Obtenir le nombre de chambres réservées pour un room type à une date donnée
   */
  private async getReservedRoomsCount(roomTypeId: number, date: DateTime): Promise<number> {
    try {
      // Compter les chambres occupées par des réservations actives
      const reservedCount = await Room.query()
        .where('room_type_id', roomTypeId)
        .where('is_deleted', false)
        .whereHas('reservationRooms', (query) => {
          query
            .where('check_in_date', '<=', date.toISODate())
            .where('check_out_date', '>', date.toISODate())
            .whereIn('status', ['reserved', 'checked_in'])
        })
        .count('* as total')

      return reservedCount[0]?.$extras.total || 0

    } catch (error) {
      logger.error(`❌ Error counting reserved rooms:`, error)
      return 0
    }
  }

  /**
   * Mettre à jour la disponibilité sur Channex
   */
  private async updateAvailabilityOnChannex(propertyId: string, availabilityData: any) {
    try {
      logger.info(`🚀 START updateAvailabilityOnChannex for property ${propertyId}`, {
        propertyId,
        updatesCount: availabilityData.values?.length || 0,
        dates: availabilityData.values?.map((v: any) => v.date_from)
      })

      console.log('🔥 BLOCK AVAILABILITY PAYLOAD:', JSON.stringify(availabilityData, null, 2))

      const response = await this.channexService.updateAvailability(propertyId, availabilityData)

      // Vérifier la réponse de Channex
      if (response && response.success !== false) {
        logger.info(`✅ SUCCESS updateAvailabilityOnChannex for property ${propertyId}`, {
          propertyId,
          updatesCount: availabilityData.values?.length || 0,
          responseId: response.id || response.data?.id,
          responseStatus: response.status || response.data?.status
        })

        console.log('✅ CHANNEX BLOCK UPDATE SUCCESS:', JSON.stringify(response, null, 2))
      } else {
        logger.warn(`⚠️ PARTIAL SUCCESS updateAvailabilityOnChannex for property ${propertyId}`, {
          propertyId,
          response: response,
          hasError: response?.error || response?.errors
        })

        console.log('⚠️ CHANNEX BLOCK UPDATE WARNING:', JSON.stringify(response, null, 2))
      }

      return response

    } catch (error) {
      logger.error(`❌ FAILED updateAvailabilityOnChannex for property ${propertyId}:`, {
        propertyId,
        error: error.message,
        stack: error.stack,
        payloadSize: availabilityData.values?.length || 0
      })

      console.log('❌ CHANNEX BLOCK UPDATE FAILED:', error)
      throw error
    }
  }

  /**
   * Obtenir les dates impactées par un blocage
   */
  private getImpactedDates(startDate: DateTime, endDate: DateTime): DateTime[] {
    const dates: DateTime[] = []
    let currentDate = startDate.startOf('day')

    logger.debug(`📅 Calculating impacted dates from ${startDate.toISODate()} to ${endDate.toISODate()}`)

    while (currentDate < endDate) {
      dates.push(currentDate)
      currentDate = currentDate.plus({ days: 1 })
    }

    logger.debug(`📅 Found ${dates.length} impacted dates`, {
      dates: dates.map(d => d.toISODate())
    })

    return dates
  }

  /**
   * Méthode de debug pour analyser la disponibilité
   */
  async debugAvailability(roomTypeId: number, date: DateTime) {
    try {
      const totalRooms = await this.getTotalRoomsCount(roomTypeId)
      const blockedRooms = await this.getBlockedRoomsCount(roomTypeId, date)
      const availableRooms = Math.max(0, totalRooms - blockedRooms)

      logger.info(`🔍 DEBUG Availability for roomType ${roomTypeId} on ${date.toISODate()}`, {
        totalRooms,
        blockedRooms,
        availableRooms,
        stopSell: availableRooms === 0
      })

      return {
        totalRooms,
        blockedRooms,
        availableRooms,
        stopSell: availableRooms === 0
      }

    } catch (error) {
      logger.error(`❌ Error in debugAvailability:`, error)
      throw error
    }
  }
}