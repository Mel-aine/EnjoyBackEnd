// app/Services/ChannexBlockService.ts
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'
import RoomBlock from '#models/room_block'
import RoomType from '#models/room_type'
import Room from '#models/room'
import ReservationRoom from '#models/reservation_room'
import Reservation from '#models/reservation'
import { DateTime } from 'luxon'

export default class ChannexBlockService {
  private channexService: ChannexService

  constructor() {
    this.channexService = new ChannexService()
  }

  /**
   * EXACTEMENT LA MÊME MÉTHODE QUE getRoomStatusData
   */
  private async calculateRoomAvailability(serviceId: number, date: DateTime, roomTypeId?: number): Promise<{
    availableRooms: number
    occupiedRooms: number
    blockedRooms: number
    totalRooms: number
  }> {
    const targetDate = date

    const [roomStatusCounts, roomStatusDayUse, roomStatusComplimentary, roomBlocksForDate] = await Promise.all([
      Room.query()
        .where('hotel_id', serviceId)
        .if(roomTypeId, (query) => query.where('room_type_id', roomTypeId!))
        .groupBy('status')
        .select('status')
        .count('* as total'),
      
      ReservationRoom.query()
        .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
        .where('reservations.hotel_id', serviceId)
        .where('reservation_rooms.status', 'day_use')
        .if(roomTypeId, (query) => query.whereHas('room', (roomQuery) => roomQuery.where('room_type_id', roomTypeId!)))
        .count('* as total'),
      
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('complimentary_room', true)
        .if(roomTypeId, (query) => query.whereHas('reservationRooms', (rrQuery) => {
          rrQuery.whereHas('room', (roomQuery) => roomQuery.where('room_type_id', roomTypeId!))
        }))
        .count('* as total'),
      
      // Récupération des chambres bloquées pour la date donnée
      RoomBlock.query()
        .where('hotel_id', serviceId)
        .where('block_from_date', '<=', targetDate.toFormat('yyyy-MM-dd'))
        .where('block_to_date', '>=', targetDate.toFormat('yyyy-MM-dd'))
        .whereNot('status', 'completed')
        .if(roomTypeId, (query) => query.where('room_type_id', roomTypeId!))
        .select('id', 'room_id', 'block_from_date', 'block_to_date', 'reason', 'description')
        .preload('room', (roomQuery) => roomQuery.select('id', 'room_number'))
    ])

    // Créer un Set des IDs des chambres bloquées
    const blockedRoomIds = new Set<number>()
    roomBlocksForDate.forEach(block => {
      if (block.room) {
        blockedRoomIds.add(block.room.id)
      }
    })

    // Optimisation: construire une map des statuts pour éviter des recherches répétées
    const statusCounts = new Map<string, number>()
    for (const item of roomStatusCounts) {
      statusCounts.set(item.status as any, Number(item.$extras.total || 0))
    }

    // Calculer le total des chambres depuis les comptes groupés
    const totalRooms = Array.from(statusCounts.values()).reduce((sum, n) => sum + n, 0)
    const occupiedRooms =
      (statusCounts.get('occupied') || 0) +
      Number(roomStatusDayUse[0].$extras.total || '0') +
      Number(roomStatusComplimentary[0].$extras.total || '0')

    const roomsInMaintenanceCount = statusCounts.get('in_maintenance') || 0

    // Nombre de chambres bloquées pour la date
    const blockedRoomsCount = blockedRoomIds.size

    // ✅ EXACTEMENT LA MÊME FORMULE
    const availableRooms = Math.max(totalRooms - occupiedRooms - roomsInMaintenanceCount - blockedRoomsCount, 0)

    logger.debug(`🏨 Room availability calculation for ${targetDate.toFormat('yyyy-MM-dd')}`, {
      serviceId,
      roomTypeId,
      totalRooms,
      occupiedRooms,
      roomsInMaintenanceCount,
      blockedRoomsCount,
      availableRooms,
      formula: `${totalRooms} - ${occupiedRooms} - ${roomsInMaintenanceCount} - ${blockedRoomsCount} = ${availableRooms}`,
      statusBreakdown: Object.fromEntries(statusCounts),
      blockedRoomIds: Array.from(blockedRoomIds)
    })

    return {
      availableRooms,
      occupiedRooms,
      blockedRooms: roomsInMaintenanceCount + blockedRoomsCount,
      totalRooms
    }
  }

  /**
   * ============================================================================
   * MÉTHODES PRINCIPALES DE SYNCHRONISATION
   * ============================================================================
   */

  /**
   * Synchroniser la disponibilité après un blocage de chambre
   */
  async syncAvailabilityAfterRoomBlock(roomBlock: RoomBlock, hotelChannexId: string) {
    try {
      logger.info(`🚫 START syncAvailabilityAfterRoomBlock for room block ${roomBlock.id}`)

      await roomBlock.load('roomType')

      if (!roomBlock.roomType?.channexRoomTypeId) {
        logger.warn(`❌ Cannot sync block - room type not synced`)
        return
      }

      const impactedDates = this.getImpactedDates(roomBlock.blockFromDate, roomBlock.blockToDate)
      
      const availabilityData = await this.calculateBlockAvailability(
        roomBlock.hotelId,
        roomBlock.roomTypeId,
        roomBlock.roomType.channexRoomTypeId,
        hotelChannexId,
        impactedDates,
        'block'
      )

      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, availabilityData)

      logger.info(`✅ Availability UPDATED after room block ${roomBlock.id}`)

      return updateResult

    } catch (error) {
      logger.error(`❌ FAILED syncAvailabilityAfterRoomBlock:`, error)
      throw error
    }
  }

  /**
   * Synchroniser la disponibilité après levée d'un blocage
   */
  async syncAvailabilityAfterRoomUnblock(roomBlock: RoomBlock, hotelChannexId: string) {
    try {
      logger.info(`🔄 START syncAvailabilityAfterRoomUnblock for room block ${roomBlock.id}`)

      await roomBlock.load('roomType')

      if (!roomBlock.roomType?.channexRoomTypeId) {
        logger.warn(`❌ Cannot sync unblock - room type not synced`)
        return
      }

      const impactedDates = this.getImpactedDates(roomBlock.blockFromDate, roomBlock.blockToDate)
      
      const availabilityData = await this.calculateBlockAvailability(
        roomBlock.hotelId,
        roomBlock.roomTypeId,
        roomBlock.roomType.channexRoomTypeId,
        hotelChannexId,
        impactedDates,
        'unblock'
      )

      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, availabilityData)

      logger.info(`✅ Availability RESTORED after room unblock ${roomBlock.id}`)

      return updateResult

    } catch (error) {
      logger.error(`❌ FAILED syncAvailabilityAfterRoomUnblock:`, error)
      throw error
    }
  }

  /**
   * Calcul de disponibilité avec la logique identique
   */
  private async calculateBlockAvailability(
    serviceId: number,
    roomTypeId: number,
    roomTypeChannexId: string,
    hotelChannexId: string,
    dates: DateTime[],
    action: 'block' | 'unblock'
  ): Promise<any> {
    logger.info(`🧮 Calculating block availability for ${dates.length} dates`)

    const values = []

    for (const date of dates) {
      // ✅ UTILISER LA MÊME LOGIQUE QUE getRoomStatusData
      const currentAvailability = await this.calculateRoomAvailability(
        serviceId,
        date,
        roomTypeId
      )

      // Calculer la nouvelle disponibilité selon l'action
      const updatedAvailability = this.calculateNewAvailability(
        currentAvailability,
        action
      )

      logger.debug(`📊 Availability for ${date.toISODate()}`, {
        current: currentAvailability.availableRooms,
        updated: updatedAvailability.availableRooms,
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

    return { values }
  }

  /**
   * Calculer la nouvelle disponibilité avec action
   */
  private calculateNewAvailability(
    currentAvailability: { availableRooms: number },
    action: 'block' | 'unblock'
  ): { availableRooms: number; stopSell: boolean } {
    
    let updatedRooms = currentAvailability.availableRooms

    if (action === 'block') {
      updatedRooms = Math.max(0, currentAvailability.availableRooms - 1)
    } else if (action === 'unblock') {
      updatedRooms = currentAvailability.availableRooms + 1
    }

    const stopSell = updatedRooms === 0

    return {
      availableRooms: updatedRooms,
      stopSell
    }
  }

  /**
   * ============================================================================
   * MÉTHODES UTILITAIRES
   * ============================================================================
   */

  /**
   * Obtenir les dates impactées par un blocage
   */
  private getImpactedDates(startDate: DateTime, endDate: DateTime): DateTime[] {
    const dates: DateTime[] = []
    let currentDate = startDate.startOf('day')

    while (currentDate < endDate) {
      dates.push(currentDate)
      currentDate = currentDate.plus({ days: 1 })
    }

    return dates
  }

  /**
   * Mettre à jour la disponibilité sur Channex
   */
  private async updateAvailabilityOnChannex(propertyId: string, availabilityData: any) {
    try {
      logger.info(`🚀 Updating availability on Channex for ${availabilityData.values.length} dates`)

      const response = await this.channexService.updateAvailability(propertyId, availabilityData)

      if (response && response.success !== false) {
        logger.info(`✅ Channex availability updated successfully`)
      } else {
        logger.warn(`⚠️ Channex update partial success`)
      }

      return response

    } catch (error) {
      logger.error(`❌ Channex update failed:`, error)
      throw error
    }
  }

}