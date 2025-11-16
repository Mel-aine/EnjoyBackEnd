// app/Services/ChannexAvailabilityService.ts
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'
import Reservation from '#models/reservation'
import RoomType from '#models/room_type'
import Room from '#models/room'
import ReservationRoom from '#models/reservation_room'
import RoomBlock from '#models/room_block'
import { DateTime } from 'luxon'

export default class ChannexAvailabilityService {
  private channexService: ChannexService

  constructor() {
    this.channexService = new ChannexService()
  }

  /**
   * SYNCHRONISATION UNIFIÉE - Respecte toutes les conditions
   * Déclenché par: Nouvelle réservation, modification, annulation, suppression
   */
  async syncAvailabilityForReservation(reservation: Reservation, hotelChannexId: string) {
    try {
      logger.info(`🔄 SYNC AVAILABILITY for reservation ${reservation.id}`, {
        reservationId: reservation.id,
        status: reservation.status,
        hotelChannexId,
        trigger: 'reservation_event'
      })

      // Charger toutes les reservationRooms avec roomType
      await reservation.load('reservationRooms', (query) => {
        query.preload('roomType')
      })
      
      if (reservation.reservationRooms.length === 0) {
        logger.warn(`❌ No reservation rooms found for reservation ${reservation.id}`)
        return
      }

      // ✅ CALCULER LA DISPONIBILITÉ POUR CHAQUE ROOM TYPE IMPACTÉ
      const roomTypeAvailabilityData = await this.calculateAllRoomTypesAvailability(
        reservation.hotelId,
        reservation.reservationRooms,
        hotelChannexId,
        reservation
      )

      if (roomTypeAvailabilityData.values.length === 0) {
        logger.info(`ℹ️ No room types to sync for reservation ${reservation.id}`)
        return
      }

      // ✅ ENVOI UNIQUE À CHANNEX (Batch Update)
      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, roomTypeAvailabilityData)

      logger.info(`✅ AVAILABILITY SYNC COMPLETE for reservation ${reservation.id}`, {
        reservationId: reservation.id,
        roomTypesCount: new Set(reservation.reservationRooms.map(rr => rr.roomTypeId)).size,
        datesCount: roomTypeAvailabilityData.values.length,
        updateSuccess: true,
        action: this.getActionFromReservationStatus(reservation.status)
      })

      return updateResult

    } catch (error) {
      logger.error(`❌ FAILED syncAvailabilityForReservation for reservation ${reservation.id}:`, error)
      throw error
    }
  }

  /**
   * CALCULER LA DISPONIBILITÉ POUR TOUS LES ROOM TYPES IMPACTÉS
   */
  private async calculateAllRoomTypesAvailability(
    hotelId: number,
    reservationRooms: ReservationRoom[],
    hotelChannexId: string,
    reservation: Reservation
  ): Promise<any> {
    // Regrouper les reservationRooms par roomTypeId
    const roomTypesMap = new Map<number, ReservationRoom[]>()
    
    reservationRooms.forEach(reservationRoom => {
      // ✅ SUPPRIMER TOUTE CONDITION SUR LE STATUT DU ROOMTYPE
      if (reservationRoom.roomType?.channexRoomTypeId) {
        if (!roomTypesMap.has(reservationRoom.roomTypeId)) {
          roomTypesMap.set(reservationRoom.roomTypeId, [])
        }
        roomTypesMap.get(reservationRoom.roomTypeId)!.push(reservationRoom)
      }
    })

    const allValues = []

    // ✅ POUR CHAQUE ROOM TYPE IMPACTÉ
    for (const [roomTypeId, rooms] of roomTypesMap.entries()) {
      const roomType = rooms[0].roomType!
      const action = this.getActionFromReservationStatus(reservation.status)
      
      if (!action) {
        logger.info(`⏸️ No action for reservation ${reservation.id}, status: ${reservation.status}`)
        continue
      }

      // ✅ DÉTERMINER LES DATES IMPACTÉES (union de toutes les dates des reservationRooms)
      const allImpactedDates = this.getAllImpactedDates(rooms)
      
      logger.info(`🧮 Calculating availability for roomType ${roomTypeId}`, {
        roomTypeId,
        roomTypeName: roomType.roomTypeName,
        channexRoomTypeId: roomType.channexRoomTypeId,
        action,
        roomsCount: rooms.length,
        datesCount: allImpactedDates.length,
        dates: allImpactedDates.map(d => d.toISODate())
      })

      // ✅ CALCULER LA DISPONIBILITÉ POUR CHAQUE DATE
      const roomTypeValues = await this.calculateRoomTypeAvailability(
        hotelId,
        roomTypeId,
        roomType.channexRoomTypeId!,
        hotelChannexId,
        allImpactedDates,
        rooms.length, // Nombre de chambres impactées
        action
      )

      allValues.push(...roomTypeValues)
    }

    return { values: allValues }
  }

  /**
   * CALCULER LA DISPONIBILITÉ POUR UN ROOM TYPE SPÉCIFIQUE
   */
  private async calculateRoomTypeAvailability(
    hotelId: number,
    roomTypeId: number,
    roomTypeChannexId: string,
    hotelChannexId: string,
    dates: DateTime[],
    roomsImpacted: number,
    action: 'reduce' | 'restore'
  ): Promise<any[]> {
    const values = []

    for (const date of dates) {
      // ✅ CALCUL EXACT COMME getRoomStatusData
      const currentAvailability = await this.calculateRoomAvailability(hotelId, date, roomTypeId)
      
      // ✅ APPLIQUER L'ACTION (réduction ou restauration)
      const updatedAvailability = this.applyAvailabilityAction(
        currentAvailability,
        roomsImpacted,
        action
      )

      logger.debug(`📊 RoomType ${roomTypeId} availability for ${date.toISODate()}`, {
        date: date.toISODate(),
        roomTypeId,
        currentAvailable: currentAvailability.availableRooms,
        updatedAvailable: updatedAvailability.availableRooms,
        roomsImpacted,
        action,
        stopSell: updatedAvailability.stopSell
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

    return values
  }

  /**
   * CALCUL DE DISPONIBILITÉ - MÊME LOGIQUE QUE getRoomStatusData
   */
  private async calculateRoomAvailability(hotelId: number, date: DateTime, roomTypeId?: number): Promise<{
    availableRooms: number
    occupiedRooms: number
    blockedRooms: number
    totalRooms: number
  }> {
    const targetDate = date

    const [roomStatusCounts, roomStatusDayUse, roomStatusComplimentary, roomBlocksForDate] = await Promise.all([
      Room.query()
        .where('hotel_id', hotelId)
        .if(roomTypeId, (query) => query.where('room_type_id', roomTypeId!))
        .groupBy('status')
        .select('status')
        .count('* as total'),
      
      ReservationRoom.query()
        .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
        .where('reservations.hotel_id', hotelId)
        .where('reservation_rooms.status', 'day_use')
        .if(roomTypeId, (query) => query.whereHas('room', (roomQuery) => roomQuery.where('room_type_id', roomTypeId!)))
        .count('* as total'),
      
      Reservation.query()
        .where('hotel_id', hotelId)
        .where('complimentary_room', true)
        .if(roomTypeId, (query) => query.whereHas('reservationRooms', (rrQuery) => {
          rrQuery.whereHas('room', (roomQuery) => roomQuery.where('room_type_id', roomTypeId!))
        }))
        .count('* as total'),
      
      RoomBlock.query()
        .where('hotel_id', hotelId)
        .where('block_from_date', '<=', targetDate.toFormat('yyyy-MM-dd'))
        .where('block_to_date', '>=', targetDate.toFormat('yyyy-MM-dd'))
        .whereNot('status', 'completed')
        .if(roomTypeId, (query) => query.where('room_type_id', roomTypeId!))
        .select('id', 'room_id', 'block_from_date', 'block_to_date', 'reason', 'description')
        .preload('room', (roomQuery) => roomQuery.select('id', 'room_number'))
    ])

    // MÊME LOGIQUE QUE getRoomStatusData
    const blockedRoomIds = new Set<number>()
    roomBlocksForDate.forEach(block => {
      if (block.room) {
        blockedRoomIds.add(block.room.id)
      }
    })

    const statusCounts = new Map<string, number>()
    for (const item of roomStatusCounts) {
      statusCounts.set(item.status as any, Number(item.$extras.total || 0))
    }

    const totalRooms = Array.from(statusCounts.values()).reduce((sum, n) => sum + n, 0)
    const occupiedRooms =
      (statusCounts.get('occupied') || 0) +
      Number(roomStatusDayUse[0].$extras.total || '0') +
      Number(roomStatusComplimentary[0].$extras.total || '0')

    const roomsInMaintenanceCount = statusCounts.get('in_maintenance') || 0
    const blockedRoomsCount = blockedRoomIds.size

    const availableRooms = Math.max(0, totalRooms - occupiedRooms - roomsInMaintenanceCount - blockedRoomsCount)

    return {
      availableRooms,
      occupiedRooms,
      blockedRooms: roomsInMaintenanceCount + blockedRoomsCount,
      totalRooms
    }
  }

  /**
   * APPLIQUER L'ACTION DE DISPONIBILITÉ
   */
  private applyAvailabilityAction(
    currentAvailability: { availableRooms: number; totalRooms: number; blockedRooms: number },
    roomsImpacted: number,
    action: 'reduce' | 'restore'
  ): { availableRooms: number; stopSell: boolean } {
    
    let updatedRooms = currentAvailability.availableRooms

    if (action === 'reduce') {
      // RÉDUIRE la disponibilité
      updatedRooms = Math.max(0, currentAvailability.availableRooms - roomsImpacted)
    } else if (action === 'restore') {
      // RESTAURER la disponibilité - ne pas dépasser le maximum théorique
      const theoreticalMax = currentAvailability.totalRooms - currentAvailability.blockedRooms
      updatedRooms = Math.min(theoreticalMax, currentAvailability.availableRooms + roomsImpacted)
    }

    const stopSell = updatedRooms === 0

    return {
      availableRooms: updatedRooms,
      stopSell
    }
  }

  /**
   * OBTENIR TOUTES LES DATES IMPACTÉES (union de toutes les reservationRooms)
   */
  private getAllImpactedDates(reservationRooms: ReservationRoom[]): DateTime[] {
    const allDates = new Set<string>()
    
    reservationRooms.forEach(room => {
      const dates = this.getImpactedDates(room.checkInDate, room.checkOutDate)
      dates.forEach(date => allDates.add(date.toISODate()!))
    })

    return Array.from(allDates).map(dateStr => DateTime.fromISO(dateStr))
  }

  /**
   * OBTENIR LES DATES IMPACTÉES POUR UNE RÉSERVATION
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
   * DÉTERMINER L'ACTION SELON LE STATUT
   */
  private getActionFromReservationStatus(status: string): 'reduce' | 'restore' | null {
    const statusMap: { [key: string]: 'reduce' | 'restore' | null } = {
      // ✅ RÉDUIRE la disponibilité
      'confirmed': 'reduce',
      'checked_in': 'reduce',
      'guaranteed': 'reduce',
      
      // ✅ RESTAURER la disponibilité  
      'cancelled': 'restore',
      'no_show': 'restore',
      'voided': 'restore',
      'rejected': 'restore',
      
      // ⏸️ PAS D'ACTION
      'pending': null,
      'inquiry': null,
      'waitlist': null,
      'checked_out': null
    }

    return statusMap[status] || null
  }

  /**
   * MISE À JOUR UNIQUE SUR CHANNEX (Batch Update)
   */
  private async updateAvailabilityOnChannex(propertyId: string, availabilityData: any) {
    try {
      logger.info(`🚀 BATCH UPDATE to Channex for ${availabilityData.values.length} date/roomType combinations`)

      const response = await this.channexService.updateAvailability(propertyId, availabilityData)

      if (response && (response as any)?.success !== false) {
        logger.info(`✅ BATCH UPDATE SUCCESS to Channex`)
      } else {
        logger.warn(`⚠️ BATCH UPDATE PARTIAL SUCCESS to Channex`)
      }

      return response

    } catch (error) {
      logger.error(`❌ BATCH UPDATE FAILED to Channex:`, error)
      throw error
    }
  }

  /**
   * MÉTHODE DE DEBUG
   */
  async debugAvailability(hotelId: number, roomTypeId: number, date: DateTime) {
    try {
      const availability = await this.calculateRoomAvailability(hotelId, date, roomTypeId)

      logger.info(`🔍 DEBUG Availability for roomType ${roomTypeId} on ${date.toISODate()}`, {
        hotelId,
        roomTypeId,
        ...availability
      })

      return availability

    } catch (error) {
      logger.error(`❌ Error in debugAvailability:`, error)
      throw error
    }
  }
}