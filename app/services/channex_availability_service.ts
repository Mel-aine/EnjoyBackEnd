// app/Services/ChannexAvailabilityService.ts
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'
import Reservation from '#models/reservation'
import RoomType from '#models/room_type'
import RoomRate from '#models/room_rate'
import Room from '#models/room'
import { DateTime } from 'luxon'

export default class ChannexAvailabilityService {
  private channexService: ChannexService

  constructor() {
    this.channexService = new ChannexService()
  }

  /**
   * Synchroniser la disponibilité après un événement de réservation (réduction)
   */
  async syncAvailabilityAfterReservation(reservation: Reservation, hotelChannexId: string) {
    try {
      logger.info(`🔄 START syncAvailabilityAfterReservation for reservation ${reservation.id}`)
  
      // Charger les reservationRooms avec roomType
      await reservation.load('reservationRooms', (query) => {
        query.preload('roomType')
      })
      
      const reservationRoom = reservation.reservationRooms[0]
      
      if (!reservationRoom) {
        logger.warn(`❌ No reservation rooms found for reservation ${reservation.id}`)
        return
      }
      
      if (!reservationRoom.roomType?.channexRoomTypeId) {
        logger.warn(`❌ Cannot sync availability - room type not synced for reservation ${reservation.id}`, {
          reservationId: reservation.id,
          roomTypeId: reservationRoom.roomTypeId,
          hasRoomType: !!reservationRoom.roomType,
          channexRoomTypeId: reservationRoom.roomType?.channexRoomTypeId
        })
        return
      }
  
      const arrivalDate = reservation.arrivedDate || reservation.scheduledArrivalDate
      const departureDate = reservation.departDate || reservation.scheduledDepartureDate
  
      if (!arrivalDate || !departureDate) {
        logger.warn(`❌ Cannot sync availability - missing dates for reservation ${reservation.id}`)
        return
      }
  
      const impactedDates = this.getImpactedDates(arrivalDate, departureDate)
      
      // RÉDUIRE la disponibilité
      const availabilityData = await this.calculateUpdatedAvailability(
        reservationRoom.roomTypeId, // Utiliser le roomTypeId de ReservationRoom
        reservationRoom.roomType.channexRoomTypeId,
        hotelChannexId,
        impactedDates,
        reservation,
        'reduce'
      )
  
      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, availabilityData)
  
      logger.info(`✅ Availability REDUCED after reservation ${reservation.id}`, {
        reservationId: reservation.id,
        roomTypeId: reservationRoom.roomTypeId,
        channexRoomTypeId: reservationRoom.roomType.channexRoomTypeId,
        status: reservation.reservationStatus,
        datesCount: impactedDates.length,
        action: 'reduce',
        updateSuccess: true
      })
  
      return updateResult
  
    } catch (error) {
      logger.error(`❌ FAILED syncAvailabilityAfterReservation for reservation ${reservation.id}:`, error)
      throw error
    }
  }

  /**
   * Synchroniser la disponibilité après annulation/no-show/voided (restauration)
   */
  async syncAvailabilityAfterReservationCancellation(reservation: Reservation, hotelChannexId: string) {
    try {
      logger.info(`🔄 START syncAvailabilityAfterReservationCancellation for reservation ${reservation.id}`, {
        reservationId: reservation.id,
        hotelChannexId,
        status: reservation.reservationStatus
      })

      // Charger les reservationRooms avec roomType pour l'annulation aussi
      await reservation.load('reservationRooms', (query) => {
        query.preload('roomType')
      })
      
      const reservationRoom = reservation.reservationRooms[0]
      
      if (!reservationRoom) {
        logger.warn(`❌ No reservation rooms found for cancellation ${reservation.id}`)
        return
      }

      if (!reservationRoom.roomType?.channexRoomTypeId) {
        logger.warn(`❌ Cannot sync availability cancellation - room type not synced for reservation ${reservation.id}`)
        return
      }

      const arrivalDate = reservation.arrivedDate || reservation.scheduledArrivalDate
      const departureDate = reservation.departDate || reservation.scheduledDepartureDate

      if (!arrivalDate || !departureDate) {
        logger.warn(`❌ Cannot sync availability cancellation - missing dates for reservation ${reservation.id}`)
        return
      }

      const impactedDates = this.getImpactedDates(arrivalDate, departureDate)
      
      logger.info(`📅 Processing ${impactedDates.length} dates for cancellation ${reservation.id}`, {
        arrivalDate: arrivalDate.toISODate(),
        departureDate: departureDate.toISODate(),
        dates: impactedDates.map(d => d.toISODate())
      })
      
      // RESTAURER la disponibilité
      const availabilityData = await this.calculateUpdatedAvailability(
        reservationRoom.roomTypeId,
        reservationRoom.roomType.channexRoomTypeId,
        hotelChannexId,
        impactedDates,
        reservation,
        'restore' // RESTAURER les chambres disponibles
      )

      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, availabilityData)

      logger.info(`✅ Availability RESTORED after reservation ${reservation.id}`, {
        reservationId: reservation.id,
        roomTypeId: reservationRoom.roomTypeId,
        channexRoomTypeId: reservationRoom.roomType.channexRoomTypeId,
        status: reservation.reservationStatus,
        datesCount: impactedDates.length,
        action: 'restore',
        updateSuccess: true
      })

      return updateResult

    } catch (error) {
      logger.error(`❌ FAILED syncAvailabilityAfterReservationCancellation for reservation ${reservation.id}:`, {
        reservationId: reservation.id,
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }

  /**
   * Calculer la disponibilité mise à jour avec action spécifique
   */
  private async calculateUpdatedAvailability(
    roomTypeId: number,
    roomTypeChannexId: string,
    hotelChannexId: string,
    dates: DateTime[],
    reservation: Reservation,
    action: 'reduce' | 'restore'
  ): Promise<any> {
    logger.info(`🧮 Calculating updated availability for ${dates.length} dates`, {
      roomTypeId,
      roomTypeChannexId,
      hotelChannexId,
      action,
      roomsRequested: reservation.roomsRequested || 1
    })

    const values = []

    for (const date of dates) {
      const currentAvailability = await this.getCurrentAvailability(roomTypeId, date)
      
      // Calculer la nouvelle disponibilité selon l'action
      const updatedAvailability = await this.calculateNewAvailability(
        currentAvailability,
        reservation,
        date,
        action
      )

      logger.debug(`📊 Availability calculation for ${date.toISODate()}`, {
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

    logger.info(`✅ Calculated availability data for ${values.length} dates`, {
      roomTypeChannexId,
      sampleDate: values[0]?.date_from,
      sampleAvailability: values[0]?.availability
    })

    return { values }
  }

  /**
   * Calculer la nouvelle disponibilité avec gestion des actions
   */
  private async calculateNewAvailability(
    currentAvailability: { availableRooms: number; stopSell: boolean },
    reservation: Reservation,
    date: DateTime,
    action: 'reduce' | 'restore'
  ): Promise<{ availableRooms: number; stopSell: boolean }> {
    const roomsRequested = reservation.roomsRequested || 1
    let updatedRooms = currentAvailability.availableRooms

    // Logique basée sur l'ACTION plutôt que le statut
    if (action === 'reduce') {
      // RÉDUIRE la disponibilité
      updatedRooms = Math.max(0, currentAvailability.availableRooms - roomsRequested)
    } else if (action === 'restore') {
      // RESTAURER la disponibilité
      updatedRooms = currentAvailability.availableRooms + roomsRequested
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
      logger.debug(`🔍 Getting current availability for roomType ${roomTypeId} on ${date.toISODate()}`)

      // Récupérer depuis RoomRate
      const roomRate = await RoomRate.query()
        .where('roomTypeId', roomTypeId)
        .where('rateDate', date.toISODate() as string)
        .first()

      if (roomRate) {
        logger.debug(`📋 Found RoomRate record for ${date.toISODate()}`, {
          availableRooms: roomRate.availableRooms,
          stopSell: roomRate.stopSell
        })
        return {
          availableRooms: roomRate.availableRooms || 0,
          stopSell: roomRate.stopSell || false
        }
      }

      // Calculer la disponibilité en temps réel
      const realTimeAvailability = await this.calculateRealTimeAvailability(roomTypeId, date)
      logger.debug(`🔄 Using real-time availability for ${date.toISODate()}`, {
        availableRooms: realTimeAvailability.availableRooms,
        stopSell: realTimeAvailability.stopSell
      })

      return realTimeAvailability

    } catch (error) {
      logger.error(`❌ Error getting current availability for ${date.toISODate()}:`, error)
      return {
        availableRooms: 10,
        stopSell: false
      }
    }
  }

  /**
   * Calculer la disponibilité en temps réel depuis la table Room
   */
  private async calculateRealTimeAvailability(roomTypeId: number, date: DateTime): Promise<{
    availableRooms: number
    stopSell: boolean
  }> {
    try {
      // 1. Obtenir le nombre total de chambres actives
      const totalRooms = await this.getTotalRoomsCount(roomTypeId)
      
      // 2. Obtenir le nombre de chambres occupées/réservées
      const occupiedRooms = await this.getOccupiedRoomsCount(roomTypeId, date)
      
      // 3. Obtenir le nombre de chambres bloquées (hors-service)
      const blockedRooms = await this.getBlockedRoomsCount(roomTypeId, date)

      const availableRooms = Math.max(0, totalRooms - occupiedRooms - blockedRooms)

      logger.debug(`📊 Real-time availability calculation for ${date.toISODate()}`, {
        roomTypeId,
        totalRooms,
        occupiedRooms,
        blockedRooms,
        availableRooms
      })

      return {
        availableRooms,
        stopSell: availableRooms === 0
      }

    } catch (error) {
      logger.error(`❌ Error calculating real-time availability:`, error)
      return {
        availableRooms: 10,
        stopSell: false
      }
    }
  }

  /**
   * Obtenir le nombre total de chambres actives pour un room type
   */
  private async getTotalRoomsCount(roomTypeId: number): Promise<number> {
    try {
      const roomsCount = await Room.query()
        .where('room_type_id', roomTypeId)
        .where('is_deleted', false)
        .whereNotIn('status', ['out_of_order', 'maintenance']) // Exclure les chambres hors service permanentes
        .count('* as total')

      const count = roomsCount[0]?.$extras.total || 0
      
      logger.debug(`🏨 Total active rooms for roomType ${roomTypeId}: ${count}`)
      
      return count

    } catch (error) {
      logger.warn(`⚠️ Error counting total rooms, using default 10 for roomType ${roomTypeId}:`, error)
      return 10
    }
  }

  /**
   * Obtenir le nombre de chambres occupées/réservées pour une date
   */
  private async getOccupiedRoomsCount(roomTypeId: number, date: DateTime): Promise<number> {
    try {
      const occupiedCount = await Room.query()
        .where('room_type_id', roomTypeId)
        .where('is_deleted', false)
        .whereHas('reservationRooms', (query) => {
          query
            .where('check_in_date', '<=', date.toISODate())
            .where('check_out_date', '>', date.toISODate())
            .whereIn('status', ['reserved', 'checked_in'])
        })
        .count('* as total')

      return occupiedCount[0]?.$extras.total || 0

    } catch (error) {
      logger.error(`❌ Error counting occupied rooms:`, error)
      return 0
    }
  }

  /**
   * Obtenir le nombre de chambres bloquées (hors-service) pour une date
   */
  private async getBlockedRoomsCount(roomTypeId: number, date: DateTime): Promise<number> {
    try {
      // Compter les chambres en maintenance ou hors-service permanentes
      const blockedCount = await Room.query()
        .where('room_type_id', roomTypeId)
        .where('is_deleted', false)
        .whereIn('status', ['out_of_order', 'maintenance'])
        .count('* as total')

      return blockedCount[0]?.$extras.total || 0

    } catch (error) {
      logger.error(`❌ Error counting blocked rooms:`, error)
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

      console.log('🔥 AVAILABILITY PAYLOAD:', JSON.stringify(availabilityData, null, 2))

      const response = await this.channexService.updateAvailability(propertyId, availabilityData)

      // Vérifier la réponse de Channex
      if (response && (response as any)?.success !== false) {
        logger.info(`✅ SUCCESS updateAvailabilityOnChannex for property ${propertyId}`, {
          propertyId,
          updatesCount: availabilityData.values?.length || 0,
          responseId: (response as any)?.id ?? (response as any)?.data?.id,
          responseStatus: (response as any)?.status ?? (response as any)?.data?.status
        })

        console.log('✅ CHANNEX RESPONSE SUCCESS:', JSON.stringify(response, null, 2))
      } else {
        logger.warn(`⚠️ PARTIAL SUCCESS updateAvailabilityOnChannex for property ${propertyId}`, {
          propertyId,
          response: response,
          hasError: (response as any)?.error || (response as any)?.errors
        })

        console.log('⚠️ CHANNEX RESPONSE WARNING:', JSON.stringify(response, null, 2))
      }

      return response

    } catch (error) {
      logger.error(`❌ FAILED updateAvailabilityOnChannex for property ${propertyId}:`, {
        propertyId,
        error: error.message,
        stack: error.stack,
        payloadSize: availabilityData.values?.length || 0
      })

      console.log('❌ CHANNEX UPDATE FAILED:', error)
      throw error
    }
  }

  /**
   * Obtenir les dates impactées par une réservation
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
      const occupiedRooms = await this.getOccupiedRoomsCount(roomTypeId, date)
      const blockedRooms = await this.getBlockedRoomsCount(roomTypeId, date)
      const availableRooms = Math.max(0, totalRooms - occupiedRooms - blockedRooms)

      logger.info(`🔍 DEBUG Availability for roomType ${roomTypeId} on ${date.toISODate()}`, {
        totalRooms,
        occupiedRooms,
        blockedRooms,
        availableRooms,
        stopSell: availableRooms === 0
      })

      return {
        totalRooms,
        occupiedRooms,
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